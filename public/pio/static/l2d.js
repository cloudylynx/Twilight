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
        PIXI: "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js",
        CUBISM_CORE: "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
        CUBISM_CORE_FALLBACK: "/pio/static/live2dcubismcore.min.js",
        CUBISM2_CORE: "https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js",
        LIVE2D_DISPLAY: "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js"
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

            if (!global.PIXI || !global.PIXI.live2d) {
                await loadScript(CDN.LIVE2D_DISPLAY);
            }

            // Load Cubism 2.1 core for backward compatibility with older .moc models
            // Only if not already loaded by old l2d.js
            if (!global.Live2DModelWeb) {
                try {
                    await loadScript(CDN.CUBISM2_CORE);
                } catch (e) {
                    console.warn("[PioEngine] Cubism 2.1 core not available, .moc models won't work");
                }
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

        this.app = new PIXI.Application({
            view: canvas,
            width: w,
            height: h,
            backgroundAlpha: 0,
            antialias: true,
            resolution: global.devicePixelRatio || 1,
            autoDensity: true
        });
    };

    Engine.prototype.loadModel = async function(modelPath) {
        var self = this;

        await loadDependencies();

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

        try {
            var config = await fetchJSON(modelPath);

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

        this.modelConfig = {
            motionMap: motionMap,
            layout: layout
        };

        // Load the Live2D model via pixi-live2d-display
        var Live2DModel = PIXI.live2d.Live2DModel;

        this.model = await Live2DModel.from(actualModelPath, {
            autoInteract: false
        });

        // Position and scale
        this._positionModel();

        // Add to stage
        this.app.stage.addChild(this.model);

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
        var modelW = this.model.internalModel
            ? this.model.internalModel.getCanvasWidth()
            : 0;

        if (modelW > 0) {
            var scale = (canvasW * 0.55) / modelW;
            this.model.scale.set(scale);

            var cy = layout.center_y !== undefined ? layout.center_y : -0.12;
            this.model.y = canvasH / 2 + cy * canvasH;
        } else {
            // Fallback: use a default scale
            this.model.scale.set(0.15);
            var cy2 = layout.center_y !== undefined ? layout.center_y : -0.12;
            this.model.y = canvasH / 2 + cy2 * canvasH;
        }
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
