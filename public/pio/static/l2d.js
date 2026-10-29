/* ----
# Live2D Engine for Pio Plugin v2.0
# Supports Cubism 2.x (.moc) and Cubism 3.x/4.x (.moc3) models
# Based on pixi-live2d-display + PixiJS
# Replaces the old Cubism 2.x-only l2d.js
---- */

(function(global) {
    "use strict";

    // ============================================================
    // CDN URLs for dependencies
    // ============================================================
    var CDN = {
        PIXI: "/pio/static/vendor/pixi.min.js",
        CUBISM_CORE: "/pio/static/vendor/live2dcubismcore.min.js",
        CUBISM_CORE_FALLBACK: "/pio/static/live2dcubismcore.min.js",
        CUBISM2_CORE: "/pio/static/vendor/live2d.min.js",
        LIVE2D_DISPLAY: "/pio/static/vendor/pixi-live2d-display.min.js"
    };

    // ============================================================
    // State
    // ============================================================
    var engines = {};
    var depsLoaded = false;
    var depsPromise = null;

    // ============================================================
    // Script loader
    // ============================================================
    function loadScript(src) {
        return new Promise(function(resolve, reject) {
            var existing = document.querySelector('script[src="' + src + '"]');
            if (existing) { resolve(); return; }

            var script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = function() { resolve(); };
            script.onerror = function() { reject(new Error("Failed to load: " + src)); };
            document.head.appendChild(script);
        });
    }

    // ============================================================
    // Dependency loading
    // ============================================================
    function loadDependencies() {
        if (depsLoaded) return Promise.resolve();
        if (depsPromise) return depsPromise;

        depsPromise = (async function() {
            if (!global.PIXI) {
                await loadScript(CDN.PIXI);
            }

            if (!global.Live2DCubismCore) {
                try {
                    await loadScript(CDN.CUBISM_CORE);
                } catch (e) {
                    console.warn("[PioEngine] Primary Cubism Core failed, trying fallback...");
                    await loadScript(CDN.CUBISM_CORE_FALLBACK);
                }
            }

            // ★ 2026-10-29 修复：Cubism 2 core 必须在 pixi-live2d-display 之前加载
            // 否则 pixi-live2d-display 初始化时会报 "Live2DMotion is not defined"，
            // 导致 PIXI.live2d 挂载失败，后续 Live2DModel.from() 报 undefined。
            if (!global.Live2DModelWeb && CDN.CUBISM2_CORE) {
                try {
                    await loadScript(CDN.CUBISM2_CORE);
                } catch (e) {
                    console.warn("[PioEngine] Cubism 2.1 core not available, .moc models won't work");
                }
            }

            if (!global.PIXI || !global.PIXI.live2d) {
                await loadScript(CDN.LIVE2D_DISPLAY);
            }

            depsLoaded = true;
            console.log("[PioEngine] Dependencies loaded");
        })();

        return depsPromise;
    }

    // ============================================================
    // Utility: fetch JSON
    // ============================================================
    function fetchJSON(url) {
        return fetch(url).then(function(resp) {
            if (!resp.ok) throw new Error("Failed to fetch " + url);
            return resp.json();
        });
    }

    // ============================================================
    // Utility: random element from array
    // ============================================================
    function randomPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ============================================================
    // Engine class - one per canvas
    // ============================================================
    function Engine(canvas) {
        this.canvas = canvas;
        this.app = null;
        this.model = null;
        this.modelConfig = null;
        this.basePath = "";
        this.idleInterval = 10000;  // ms between idle motion checks
        this.lastTapTime = Date.now();
        this.idleCheckTimer = null;
        this.tickerFn = null;
    }

    Engine.prototype.destroy = function() {
        if (this.idleCheckTimer) {
            clearInterval(this.idleCheckTimer);
            this.idleCheckTimer = null;
        }
        if (this.tickerFn && this.app) {
            this.app.ticker.remove(this.tickerFn);
            this.tickerFn = null;
        }
        if (this.model) {
            try {
                this.app.stage.removeChild(this.model);
                this.model.destroy();
            } catch (e) { /* ignore */ }
            this.model = null;
        }
        if (this.app) {
            try {
                this.app.destroy(true, { children: true });
            } catch (e) { /* ignore */ }
            this.app = null;
        }
    };

    Engine.prototype.initPixiApp = function() {
        var canvas = this.canvas;
        var container = canvas.parentElement;
        var w = (container ? container.clientWidth : canvas.width) || 280;
        var h = (container ? container.clientHeight : canvas.height) || 250;

        canvas.width = w;
        canvas.height = h;

        // ★ 2026-10-29 修复：canvas 尺寸不能跟随父容器（父容器可能被撑满 1280px）
        // 固定为配置的看板娘尺寸（280x250），否则模型位置全乱
        var fixedW = 280, fixedH = 250;
        canvas.width = fixedW;
        canvas.height = fixedH;
        canvas.style.width = fixedW + 'px';
        canvas.style.height = fixedH + 'px';

        this.app = new PIXI.Application({
            view: canvas,
            width: fixedW,
            height: fixedH,
            backgroundAlpha: 0,
            antialias: true,
            resolution: 1,          // ★ 固定 1，避免 devicePixelRatio 干扰
            autoDensity: false,     // ★ 关闭自动密度
            autoStart: true,
            sharedTicker: false
        });

        // ★ 2026-10-29 修复：确保渲染循环真的在跑
        // 原代码 tickerFn 只被 remove 从未 add，导致模型从不渲染
        var selfApp = this;
        this.tickerFn = function() {
            if (selfApp.model && selfApp.model.update) {
                try { selfApp.model.update(selfApp.app.ticker.deltaMS / 1000); } catch(e) {}
                // ★ 2026-10-29：update() 后强制写回形态参数
                // 这个模型的 expressionManager 没被创建（model.expression() 是空操作），
                // 只能每帧手动 setParameterValueById 覆盖 moc3 默认值。
                selfApp._enforcePose();
            }
        };
        this.app.ticker.add(this.tickerFn);
        if (!this.app.ticker.started) this.app.ticker.start();
        console.log('[PioEngine] render ticker started, canvas=' + fixedW + 'x' + fixedH);
    };

    Engine.prototype.loadModel = async function(modelPath) {
        var self = this;

        // ★ 2026-10-29 新增：加载中提示 + 进度条
        // 模型文件较大（moc3 5MB + 贴图 11MB），慢网下需要几十秒，
        // 没有提示用户会以为坏了。
        self._showLoadingUI();

        await loadDependencies();
        self._updateProgress(30);   // 依赖加载完成

        // Clean up any previous model
        this.destroy();

        // Initialize PixiJS app on canvas
        this.initPixiApp();

        // Determine base path
        this.basePath = modelPath.substring(0, modelPath.lastIndexOf("/") + 1);

        // Try to load our model.json config; fall back to loading model directly
        var actualModelPath;
        var motionMap = {};
        var layout = { center_x: 0, center_y: -0.12, width: 1.6 };

        var config = null;   // ★ 2026-10-29：提前声明，供后续读 defaultExpression
        try {
            config = await fetchJSON(modelPath);

            if (config.model3) {
                // Our custom config pointing to a Cubism 3 model
                actualModelPath = this.basePath + config.model3;
                if (config.layout) layout = config.layout;
                if (config.motions) {
                    Object.keys(config.motions).forEach(function(group) {
                        motionMap[group] = config.motions[group].map(function(f) {
                            return f.file || "";
                        });
                    });
                }
            } else if (config.model) {
                // Cubism 2 model config (old format)
                actualModelPath = modelPath;
                if (config.layout) layout = config.layout;
                if (config.motions) {
                    Object.keys(config.motions).forEach(function(g) {
                        motionMap[g] = config.motions[g].map(function(f) {
                            return (f.file || "").replace(/\.mtn$/, "").replace(/\.motion3\.json$/, "");
                        });
                    });
                }
            } else if (config.FileReferences) {
                // Direct model3.json
                actualModelPath = modelPath;
            } else {
                actualModelPath = modelPath;
            }
        } catch (e) {
            // Could not load config; try the path directly
            actualModelPath = modelPath;
        }

        self._updateProgress(45);   // 配置解析完成

        this.modelConfig = {
            motionMap: motionMap,
            layout: layout,
            // ★ 2026-10-29：把 model.json 的 defaultExpression 传进来
            defaultExpression: (config && config.defaultExpression) || null,
            // ★ 2026-10-29：形态参数（每帧强制写回，绕过坏掉的表情系统）
            poseParams: (config && config.poseParams) || null
        };

        // Load the Live2D model via pixi-live2d-display
        var Live2DModel = PIXI.live2d.Live2DModel;

        // ★ 加载模型本体（大文件），用模拟进度让用户知道在动
        self._updateProgress(50);
        var fakePct = 50;
        var fakeTimer = setInterval(function() {
            // 每 500ms 涨一点，最多到 92%，等真实完成再跳到 100%
            fakePct = Math.min(92, fakePct + Math.random() * 4);
            self._updateProgress(fakePct);
        }, 500);

        try {
            this.model = await Live2DModel.from(actualModelPath, {
                autoInteract: false
            });
        } finally {
            clearInterval(fakeTimer);
        }
        self._updateProgress(95);

        // Position and scale
        this._positionModel();

        // Add to stage
        this.app.stage.addChild(this.model);

        // ★ 2026-10-29 诊断：打印 model 和 stage 的实际状态
        try {
            console.log('[PioEngine][DIAG] ' + JSON.stringify({
                modelType: this.model.constructor.name,
                visible: this.model.visible,
                alpha: this.model.alpha,
                x: this.model.x, y: this.model.y,
                scale: {x: this.model.scale.x, y: this.model.scale.y},
                width: this.model.width, height: this.model.height,
                internalModel: this.model.internalModel ? this.model.internalModel.constructor.name : null,
                coreModel: this.model.internalModel && this.model.internalModel.coreModel
                    ? this.model.internalModel.coreModel.constructor.name : null,
                stageChildren: this.app.stage.children.length,
                rendererSize: this.app.renderer.width + 'x' + this.app.renderer.height,
                tickerStarted: this.app.ticker.started,
                autoUpdate: this.model.autoUpdate
            }));
        } catch (e) { console.warn('[PioEngine][DIAG] error', e); }

        // ★ 2026-10-29 新增：应用默认表情（切换形态）
        // 少女VTS模型默认是「猫猫形态」（桌宠键盘猫姿势），
        // 通过 expression('standing_form') 切换到站立形态。
        var selfExpr = this;
        setTimeout(function() {
            try {
                var mc = selfExpr.modelConfig;
                var defExpr = mc && mc.defaultExpression;
                console.log('[PioEngine][EXPR] check: modelConfig=' + !!mc +
                            ' defaultExpression=' + defExpr +
                            ' model=' + !!selfExpr.model +
                            ' hasFn=' + (selfExpr.model && typeof selfExpr.model.expression === 'function'));
                if (defExpr && selfExpr.model && typeof selfExpr.model.expression === 'function') {
                    var ret = selfExpr.model.expression(defExpr);
                    console.log('[PioEngine][EXPR] applied "' + defExpr + '" ret=' + ret);
                }
            } catch (e) {
                console.warn('[PioEngine][EXPR] failed: ' + e.message + ' | stack=' + (e.stack||'').substring(0,200));
            }
        }, 800);

        // ★ 隐藏加载提示
        self._hideLoadingUI();

        // Setup interaction
        this._setupInteraction();

        // Start idle motion loop
        this._startIdleLoop();

        // Start initial idle animation
        var self = this;
        setTimeout(function() {
            self._playMotionGroup("idle");
        }, 500);
    };

    // ★ 2026-10-29 新增：加载提示 UI
    Engine.prototype._showLoadingUI = function() {
        var self = this;
        var canvas = this.canvas;
        if (!canvas || !canvas.parentElement) return;

        // 避免重复创建
        if (document.getElementById('pio-loading')) return;

        var wrap = document.createElement('div');
        wrap.id = 'pio-loading';
        wrap.style.cssText = [
            'position:absolute', 'left:0', 'top:0', 'right:0', 'bottom:0',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'background:rgba(0,0,0,.55)', 'border-radius:8px',
            'color:#fff', 'font-size:12px', 'z-index:10',
            'pointer-events:none', 'backdrop-filter:blur(2px)'
        ].join(';');

        wrap.innerHTML = [
            '<div style="margin-bottom:6px;font-size:11px;opacity:.85">看板娘加载中</div>',
            '<div style="width:70%;height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">',
            '  <div id="pio-loading-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#8b5cf6,#ec4899);transition:width .3s"></div>',
            '</div>',
            '<div id="pio-loading-pct" style="margin-top:5px;font-size:11px;opacity:.75">0%</div>'
        ].join('');

        // ★ 2026-10-29 修复：不要覆盖容器的 position！
        // pio.css 里 .pio-container 是 position: fixed + right: 0，
        // 一旦改成 relative，整个容器会掉到页面左下角。
        // 容器是 fixed，可以给 absolute 子元素做定位基准，直接用 absolute 即可。
        wrap.style.position = 'absolute';
        canvas.parentElement.appendChild(wrap);
        console.log('[PioEngine] loading UI shown');
    };

    Engine.prototype._updateProgress = function(pct) {
        var bar = document.getElementById('pio-loading-bar');
        var label = document.getElementById('pio-loading-pct');
        var p = Math.max(0, Math.min(100, Math.round(pct)));
        if (bar) bar.style.width = p + '%';
        if (label) label.textContent = p + '%';
    };

    Engine.prototype._hideLoadingUI = function() {
        var wrap = document.getElementById('pio-loading');
        if (wrap) {
            wrap.style.opacity = '0';
            wrap.style.transition = 'opacity .3s';
            setTimeout(function() { wrap.remove(); }, 350);
            console.log('[PioEngine] loading UI hidden');
        }
    };

    // ★ 2026-10-29 新增：强制维持形态参数
    // 少女VTS模型没有可用的 expressionManager，model.expression() 不会改变参数。
    // 每帧在 model.update() 之后手动写回，才能稳定维持站立形态。
    Engine.prototype._enforcePose = function() {
        if (!this.model || !this.model.internalModel) return;
        var core = this.model.internalModel.coreModel;
        if (!core || typeof core.setParameterValueById !== 'function') return;

        var pose = this.modelConfig && this.modelConfig.poseParams;
        if (!pose) return;

        try {
            for (var id in pose) {
                if (Object.prototype.hasOwnProperty.call(pose, id)) {
                    core.setParameterValueById(id, pose[id]);
                }
            }
        } catch (e) { /* 静默 */ }
    };

    Engine.prototype._positionModel = function() {
        if (!this.model) return;

        var cfg = this.modelConfig;
        var layout = cfg.layout || {};
        var canvasW = this.canvas.width;
        var canvasH = this.canvas.height;

        this.model.anchor.set(0.5, 0.5);
        this.model.x = canvasW / 2;
        this.model.y = canvasH / 2;

        // Determine model dimensions (may need a frame to be available)
        // ★ 2026-10-29 修复：getCanvasWidth 是 Cubism 2 的 API，
        // Cubism 3/4 用 coreModel.getCanvasWidth() 或 width 属性。
        // 这里做多级兜底，避免 TypeError 中断加载。
        var modelW = 0;
        try {
            var im = this.model.internalModel;
            if (im) {
                if (typeof im.getCanvasWidth === 'function') {
                    modelW = im.getCanvasWidth();
                } else if (im.coreModel && typeof im.coreModel.getCanvasWidth === 'function') {
                    modelW = im.coreModel.getCanvasWidth();
                } else if (typeof im.width === 'number' && im.width > 0) {
                    modelW = im.width;
                } else if (im.coreModel && typeof im.coreModel.getModel === 'function') {
                    var cm = im.coreModel.getModel();
                    if (cm && typeof cm.getCanvasWidth === 'function') {
                        modelW = cm.getCanvasWidth();
                    }
                }
            }
        } catch (e) {
            console.warn('[PioEngine] getCanvasWidth unavailable, using fallback scale', e);
            modelW = 0;
        }

        // ★ 2026-10-29 修复：原实现用 getCanvasWidth() 得到的值算 scale，
        // 但 Cubism 3/4 的 canvas 宽可能是 1（无效值），导致 scale 被放大到 154 倍，
        // 模型尺寸变成 246400px，完全跑到画布外。
        // 改用 model.width（PIXI 实际测量值）反推，并限制 scale 范围。
        // ★ 用 model.height（PIXI 实测高度）适配 canvas 高度
        // Live2D 模型通常是高>宽的立绘，按高度适配才能完整显示
        var scale;
        if (this.model.height > 1) {
            scale = (canvasH * 1.0) / this.model.height;   // 高度撑满
        } else if (this.model.width > 1) {
            scale = (canvasW * 0.85) / this.model.width;
        } else {
            scale = 0.15;
        }
        if (!isFinite(scale) || scale <= 0) scale = 0.15;
        scale = Math.max(0.01, Math.min(scale, 10));

        this.model.scale.set(scale);

        // 居中（y 方向用 0 偏移，让模型垂直居中而不是偏上）
        this.model.x = canvasW / 2;
        this.model.y = canvasH / 2;

        console.log('[PioEngine][DIAG] scale=' + scale.toFixed(3) +
                    ' model=' + this.model.width.toFixed(0) + 'x' + this.model.height.toFixed(0) +
                    ' pos=' + this.model.x.toFixed(0) + ',' + this.model.y.toFixed(0));
    };

    Engine.prototype._setupInteraction = function() {
        if (!this.model) return;
        var self = this;

        this.model.interactive = true;
        this.model.cursor = "pointer";

        // Listen for hit events from pixi-live2d-display
        this.model.on("hit", function(hitAreaNames) {
            self.lastTapTime = Date.now();

            if (hitAreaNames && hitAreaNames.length > 0) {
                var hit = hitAreaNames[0].toLowerCase();
                if (hit.indexOf("head") !== -1) {
                    self._playMotionGroup("flick_head");
                } else {
                    self._playMotionGroup("tap_body");
                }
            } else {
                self._playMotionGroup("tap_body");
            }
        });

        this.model.on("pointerdown", function() {
            self.lastTapTime = Date.now();
        });
    };

    Engine.prototype._playMotionGroup = function(group) {
        if (!this.model) return;
        var names = this.modelConfig.motionMap[group];
        if (!names || names.length === 0) return;

        var motionName = randomPick(names);

        // pixi-live2d-display: model.motion(groupName) plays a motion by group
        // For Cubism 3, each .motion3.json file becomes its own group
        try {
            this.model.motion(motionName);
        } catch (e) {
            // Silently ignore if motion not found
        }
    };

    Engine.prototype._startIdleLoop = function() {
        var self = this;

        // Check idle state periodically
        this.idleCheckTimer = setInterval(function() {
            if (!self.model) return;

            var dt = Date.now() - self.lastTapTime;
            if (dt < self.idleInterval) return;

            // Check if any motion is currently playing
            var playing = false;
            try {
                var mm = self.model.internalModel.motionManager;
                if (mm && !mm.isFinished()) {
                    playing = true;
                }
            } catch (e) {
                playing = false;
            }

            if (!playing) {
                self._playMotionGroup("idle");
            }
        }, 3000);
    };

    // ============================================================
    // Public API: loadlive2d(canvasId, modelPath)
    // ============================================================
    function loadLive2D(canvasId, modelPath) {
        var canvas = document.getElementById(canvasId);

        if (!canvas) {
            console.error("[PioEngine] Canvas not found:", canvasId);
            return;
        }

        // Tear down previous engine
        if (engines[canvasId]) {
            engines[canvasId].destroy();
        }

        var engine = new Engine(canvas);
        engines[canvasId] = engine;

        engine.loadModel(modelPath).catch(function(err) {
            console.error("[PioEngine] Failed to load model:", err);
        });
    }

    // ============================================================
    // Exports
    // ============================================================
    global.loadlive2d = loadLive2D;

    if (!global.Live2D) {
        global.Live2D = {};
    }

    global.Live2D.setGL = function() { /* compatibility no-op */ };

    console.log("[PioEngine] Live2D engine v2.0 ready (Cubism 2/3/4)");

})(window);
