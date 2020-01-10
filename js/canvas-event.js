(function() {
    var initializing = false;
    this.Class = function() {};
    Class.extend = function(prop) {
        var _super = this.prototype,
            prototype, name, tmp, ret;
        initializing = true;
        prototype = new this;
        initializing = false;
        for (name in prop) {
            prototype[name] = typeof prop[name] == "function" && typeof _super[name] == "function" ? function(name, fn) {
                return function() {
                    tmp = this._super;
                    this._super = _super[name];
                    ret = fn.apply(this, arguments);
                    this._super = tmp;
                    return ret
                }
            }(name, prop[name]) : prop[name]
        }

        function Class(args) {
            if (this instanceof arguments.callee) {
                if (!initializing && this.init) this.init.apply(this, args && args.callee ? args : arguments)
            } else return new arguments.callee(arguments)
        }
        Class.prototype = prototype;
        Class.constructor = Class;
        Class.extend = arguments.callee;
        return Class
    }
})();
(function(window, doc, undefined) {
    "use strict";
    var toString = Object.prototype.toString,
        func = "function",
        string = "string",
        array = "array",
        object = "object",
        USE_MOUSE_OVER_OUT = false,
        INSTANCES = [],
        TOUCH_MOVE = false,
        isTouchDevice, isIE = window.G_vmlCanvasManager,
        changeKeypress = /webkit|msie/i.exec(window.navigator.userAgent),
        ua = navigator.userAgent,
        isAndroid = ua.match(/android/i),
        isIOS = ua.match(/iphone|ipad|ipod/i),
        isWindowMobile = ua.match(/Windows Phone/i) || ua.match(/iemobile/i),
        SELECTOR = /^([#]?)([a-z][\w\-]*)$/,
        mouseButtons = ["", "LEFT", "CENTER", "RIGHT"],
        eventQueue = [],
        currentCanvas = null,
        curDrag = null,
        inDrag = false,
        hash = "Cevent" + (new Date).getTime(),
        uuid = 0,
        Cache = {},
        requestAnimFrame = function() {
            return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback, fps) {
                window.setTimeout(callback, 1e3 / 60)
            }
        }(),
        is = function(obj, type) {
            return toString.call(obj).slice(8, -1).toLowerCase() == type
        },
        each = function(iterable, callback) {
            var value, i = 0;
            if (is(iterable, array)) {
                for (;
                    (value = iterable[i++]) && callback(value, i) !== false;) {}
            }
        },
        removeElement = function(array, item) {
            var i = indexOf(array, item);
            if (i >= 0) {
                array.splice(i, 1);
                return item
            }
            return null
        },
        eventsMap = {
            click: "touchstart",
            mousedown: "touchstart",
            mousemove: "touchmove",
            mouseup: "touchend"
        },
        normalizeEvent = function(e) {
            e = e || window.event;
            if (!e.preventDefault) e.preventDefault = function() {
                this.returnValue = false
            };
            if (!e.stopPropagation) e.stopPropagation = function() {
                this.cancelBubble = true
            };
            return e
        },
        touchEventHandler = function(callback, type) {
            var touchevent = eventsMap[type];
            if (!touchevent) return callback;
            return function(event) {
                var isTouchEvent = event.type === touchevent;
                isTouchDevice = Cevent.isTouchDevice = isTouchEvent;
                if (!isTouchEvent && (isAndroid || isIOS || isWindowMobile)) {
                    return
                }
                callback.call(this, event)
            }
        },
        $ = function(id) {
            return document.getElementById(id)
        },
        addEventListener = function() {
            if (document.addEventListener) {
                return function F(elem, type, callback) {
                    if (!elem) {
                        return
                    }
                    elem = typeof elem === "string" ? $(elem) : elem;
                    callback = touchEventHandler(callback, type, elem);
                    if (eventsMap[type]) elem.addEventListener(eventsMap[type], callback, true);
                    elem.addEventListener(type, callback, true)
                }
            } else {
                return function F(elem, type, callback) {
                    if (!elem) return;
                    elem = typeof elem === "string" ? $(elem) : elem;
                    elem.attachEvent("on" + type, function(e) {
                        e = normalizeEvent(e);
                        return callback.call(e.target || e.srcElement, e)
                    })
                }
            }
        }(),
        indexOf = function() {
            if ([].indexOf) {
                return function(a, e) {
                    return a.indexOf(e)
                }
            } else {
                return function(a, e) {
                    for (var i = 0, l = a.length; i < l; i++) {
                        if (e === a[i]) {
                            return i
                        }
                    }
                    return -1
                }
            }
        }(),
        findPosition = function(obj) {
            var curleft = 0,
                curtop = 0;
            if (obj.offsetParent) {
                do {
                    curleft += obj.offsetLeft;
                    curtop += obj.offsetTop
                } while (obj = obj.offsetParent)
            }
            return {
                x: curleft,
                y: curtop
            }
        },
        data = function(obj, name, data) {
            var id = obj[hash],
                cache;
            if (!id) {
                id = obj[hash] = ++uuid
            }
            cache = Cache[id];
            if (!cache) {
                cache = Cache[id] = {}
            }
            if (name && data !== undefined) {
                cache[name] = data
            }
            return name ? cache[name] : cache
        },
        removeData = function(obj, name) {
            if (!obj) {
                return
            }
            var id = obj[hash];
            if (id && Cache[id]) {
                if (name) {
                    delete Cache[id][name]
                } else {
                    delete Cache[id]
                }
            }
        },
        addEvent = function(obj, eventType, fn) {
            var objData = data(obj),
                handlers;
            each(eventType.split(" "), function(type) {
                handlers = objData[type] = objData[type] || [];
                handlers.push(fn)
            })
        },
        handleEvent = function(obj, handlers, context, event) {
            var handler, i = 0,
                ret = true;
            context.ctx.save();
            context.ctx.scale(context.__zoom, context.__zoom);
            for (; handler = handlers[i++];) {
                if (handler.call(obj, context, event) === false) {
                    ret = false
                }
            }
            context.ctx.restore();
            if (!ret) {
                event.preventDefault()
            }
            return ret
        },
        colectEvent = function(shape, eventType, e, self) {
            var shapeHandlers = data(shape, eventType),
                globalHandlers = data(self.cv, eventType);
            if (shapeHandlers && shapeHandlers.length) {
                eventQueue.push(shape, shapeHandlers)
            }
            if (globalHandlers && globalHandlers.length) {
                eventQueue.push(shape, globalHandlers)
            }
        },
        fireEvents = function(context, event) {
            var i, l;
            context.clear();
            for (i = 0, l = eventQueue.length; i < l; i += 2) {
                handleEvent(eventQueue[i], eventQueue[i + 1], context, event)
            }
            eventQueue = [];
            context.redraw()
        },
        getObjectUnderCursor = function(e, self) {
            e.preventDefault();
            e = e.touches ? e.touches[0] : e;
            var shape, shapes = self._shapes,
                i = shapes.length;
            self.x = ((e && e.pageX - self._pos.x + 1 || window.event.offsetX + 1) - 1) / self.__zoom || 0;
            self.y = ((e && e.pageY - self._pos.y + 1 || window.event.offsetY + 1) - 1) / self.__zoom || 0;
            while (shape = shapes[--i]) {
                if (shape.hitTest(self)) {
                    return shape
                }
            }
        },
        mousemove = function(self, curHover) {
            return function(e) {
                e.preventDefault();
                e = e.touches ? e.touches[0] : e;
                self.lastX = self.x;
                self.lastY = self.y;
                curHover = self._curHover;
                var x = ((e && e.pageX - self._pos.x + 1 || window.event.offsetX + 1) - 1) / self.__zoom || 0;
                var y = ((e && e.pageY - self._pos.y + 1 || window.event.offsetY + 1) - 1) / self.__zoom || 0;
                if (!TOUCH_MOVE && Math.abs(x - self.x) < 2 && Math.abs(y - self.y) < 2) return;
                self.x = x;
                self.y = y;
                TOUCH_MOVE = true;
                if (!self._clicked && USE_MOUSE_OVER_OUT) {
                    var shapeUnderCursor = getObjectUnderCursor(e, self);
                    if (shapeUnderCursor) {
                        if (curHover !== shapeUnderCursor) {
                            colectEvent(shapeUnderCursor, "mouseover", e, self);
                            if (curHover) {
                                colectEvent(curHover, "mouseout", e, self)
                            }
                        }
                        self._curHover = curHover = shapeUnderCursor
                    } else if (curHover) {
                        colectEvent(curHover, "mouseout", e, self);
                        self._curHover = curHover = null
                    }
                }
                if (curHover) {
                    colectEvent(curHover, "mousemove", e, self)
                }
                if (eventQueue.length) {
                    fireEvents(self, e)
                }
            }
        },
        mousedown = function(self) {
            return function(e) {
                if (!USE_MOUSE_OVER_OUT) {
                    self._curHover = getObjectUnderCursor(e, self)
                }
                self._curHover;
                var curHover = self._curHover,
                    which = mouseButtons[e.which || e.button];
                self._clicked = true;
                currentCanvas = self.cv;
                self[which] = true;
                if (curHover) {
                    colectEvent(curHover, "mousedown", e, self);
                    if (curHover !== self.focused) {
                        colectEvent(curHover, "focus", e, self);
                        if (self.focused) {
                            colectEvent(self.focused, "blur", e, self)
                        }
                    }
                } else if (self.focused) {
                    colectEvent(self.focused, "blur", e, self);
                    self.focused = null
                }
                self.focused = curHover || null;
                if (eventQueue.length) {
                    fireEvents(self, e)
                }
                self[which] = false
            }
        },
        mouseup = function(self) {
            return function(e) {
                self._clicked = false;
                if (self._curHover) {
                    colectEvent(self._curHover, "mouseup", e, self);
                    if (!TOUCH_MOVE && isTouchDevice) {
                        colectEvent(self._curHover, "tap", e, self);
                        if (self.lastClick && e.timeStamp - self.lastClick < 300) {
                            colectEvent(self._curHover, "dblclick", e, self)
                        }
                        self.lastClick = e.timeStamp
                    }
                }
                TOUCH_MOVE = false;
                if (eventQueue.length) {
                    fireEvents(self, e)
                }
            }
        },
        click = function(self) {
            return function(e) {
                if (self._curHover) {
                    colectEvent(self._curHover, "click", e, self)
                }
                if (eventQueue.length) {
                    fireEvents(self, e)
                }
            }
        },
        dblclick = function(self) {
            return function(e) {
                if (self._curHover) {
                    colectEvent(self._curHover, "dblclick", e, self)
                }
                if (eventQueue.length) {
                    fireEvents(self, e)
                }
            }
        },
        keyevent = function() {
            var hotkeys = {
                    specialKeys: {
                        27: "esc",
                        9: "tab",
                        32: "space",
                        13: "return",
                        8: "backspace",
                        145: "scroll",
                        20: "capslock",
                        144: "numlock",
                        19: "pause",
                        45: "insert",
                        36: "home",
                        46: "del",
                        35: "end",
                        33: "pageup",
                        34: "pagedown",
                        37: "left",
                        38: "up",
                        39: "right",
                        40: "down",
                        109: "-",
                        112: "f1",
                        113: "f2",
                        114: "f3",
                        115: "f4",
                        116: "f5",
                        117: "f6",
                        118: "f7",
                        119: "f8",
                        120: "f9",
                        121: "f10",
                        122: "f11",
                        123: "f12",
                        191: "/",
                        96: "0",
                        97: "1",
                        98: "2",
                        99: "3",
                        100: "4",
                        101: "5",
                        102: "6",
                        103: "7",
                        104: "8",
                        105: "9",
                        106: "*",
                        107: "+",
                        110: ".",
                        111: "/",
                        187: "+",
                        189: "-"
                    },
                    shiftNums: {
                        "`": "~",
                        1: "!",
                        2: "@",
                        3: "#",
                        4: "$",
                        5: "%",
                        6: "^",
                        7: "&",
                        8: "*",
                        9: "(",
                        0: ")",
                        "-": "_",
                        "=": "+",
                        ";": ":",
                        "'": '"',
                        ",": "<",
                        ".": ">",
                        "/": "?",
                        "\\": "|"
                    }
                },
                code;
            return function(type, self) {
                var eventObj = data(self.cv, type, {}),
                    Handlers = data(eventObj);
                return function(e) {
                    if (currentCanvas !== self.cv && !self.__globalkeyevents) {
                        return
                    }
                    code = type == "keydown" ? e.keyCode : code;
                    var special = hotkeys.specialKeys[code],
                        character = special || String.fromCharCode(code || e.charCode).toLowerCase(),
                        modif = "",
                        handlers;
                    if (e.altKey) {
                        modif += "alt+"
                    }
                    if (e.ctrlKey || e.metaKey) {
                        modif += "ctrl+"
                    }
                    if (e.shiftKey) {
                        modif += "shift+"
                    }
                    handlers = Handlers[modif + character] || Handlers[modif + hotkeys.shiftNums[character]] || modif === "shift+" && Handlers[hotkeys.shiftNums[character]] || Handlers.any;
                    if (handlers) {
                        var ret = handleEvent(self, handlers, self, e);
                        if (!self.play) {
                            self.redraw()
                        }
                        return ret
                    }
                }
            }
        }(),
        Cevent = function(canvas, shapes) {
            canvas = is(canvas, string) ? doc.getElementById(canvas) : canvas;
            if (canvas.getContext || window.G_vmlCanvasManager) {
                return new Cevent.fn.init(canvas, shapes)
            } else {
                throw Error("Your browser sucks")
            }
        };
    Cevent.forse_redraw = function() {
        var i, l = INSTANCES.length;
        for (i = 0; i < l; i++) {
            INSTANCES[i].redraw()
        }
    };
    Cevent.fn = Cevent.prototype = {
        init: function(cv, shapes) {
            this.cv = cv;
            if (window.getComputedStyle) this.background = getComputedStyle(document.body).backgroundColor;
            else this.background = "#333";
            if (!cv.getContext && window.G_vmlCanvasManager) {
                G_vmlCanvasManager.initElement(cv)
            }
            this.ctx = cv.getContext("2d");
            this.width = cv.width;
            this.height = cv.height;
            this.__zoom = 1;
            this.x = 0;
            this.y = 0;
            if (!this.cv[hash]) {
                INSTANCES.push(this);
                this._shapes = data(cv, "shapes", []);
                this.__cache = data(cv, "cache", document.createElement("canvas"));
                this._last = null;
                if (window.G_vmlCanvasManager) {
                    G_vmlCanvasManager.initElement(this.__cache)
                }
                this.__cachectx = this.__cache && this.__cache.getContext("2d");
                this.calcCanvasPosition();
                if (false) {
                    addEventListener(cv, "touchmove", mousemove(this), false);
                    addEventListener(cv, "touchend", mouseup(this), false);
                    addEventListener(cv, "touchstart", mousedown(this), false)
                } else {
                    addEventListener(cv, "mousemove", mousemove(this), false);
                    addEventListener(cv, "dblclick", dblclick(this), false);
                    addEventListener(cv, "click", click(this), false);
                    addEventListener(cv, "mouseup", mouseup(this), false);
                    addEventListener(cv, "mousedown", mousedown(this), false);
                    addEventListener(doc, "keydown", keyevent("keydown", this), false);
                    addEventListener(doc, "keyup", keyevent("keyup", this), false);
                    if (!changeKeypress) {
                        addEventListener(doc, "keypress", keyevent("keypress", this), false)
                    }
                    if ("onselectstart" in cv) {
                        cv.onselectstart = function() {
                            return false
                        };
                        cv.onmousedown = function() {
                            return false
                        }
                    }
                }
            } else {
                this._shapes = data(cv, "shapes");
                this._last = shapes
            }
        },
        updateCache: function() {
            if (!this.__cache) {
                return
            }
            this.__cache.width = this.cv.width;
            this.__cache.height = this.cv.height;
            removeElement(this._shapes, curDrag);
            this.draw();
            this._shapes.push(curDrag);
            this.__cachectx.drawImage(this.cv, 0, 0)
        },
        calcCanvasPosition: function() {
            this._pos = findPosition(this.cv);
            return this
        },
        get: function(i) {
            i = i < 0 ? this._shapes.length + i : i;
            return this._shapes[i] || this._shapes
        },
        getAll: function(selector) {
            var ret = [],
                match = SELECTOR.exec(selector),
                type, name;
            if (selector === "*") {
                ret = this._shapes.slice(0)
            } else if (match) {
                type = match[1];
                name = match[2];
                each(this._shapes, function(shape) {
                    if (shape[type] === name) {
                        ret.push(shape)
                    }
                })
            }
            return ret
        },
        remove: function(shape) {
            removeData(removeElement(this._shapes, shape));
            return this.redraw()
        },
        addId: function(id) {
            var match = SELECTOR.exec(id),
                shapes = this._last;
            if (match && !match[1] && shapes) {
                if (!shapes.length) {
                    shapes["#"] = id
                } else {
                    each(shapes, function(shape) {
                        shape["#"] = id
                    })
                }
            }
            return this
        },
        removeId: function() {
            var shapes = this._last;
            if (shapes && !shapes.length) {
                shapes["#"] = ""
            } else {
                each(shapes, function(shape) {
                    shape["#"] = ""
                })
            }
            return this
        },
        find: function(selector) {
            var ret = this.getAll(selector);
            return Cevent(this.cv, ret.length == 1 ? ret[0] : ret)
        },
        attr: function(attrs, value) {
            var shapes = this._last;
            if (shapes && shapes.attr) {
                shapes.attr(attrs, value)
            } else {
                each(shapes, function(shape) {
                    shape.attr(attrs, value)
                })
            }
            return this
        },
        rotate: function(angle) {
            return this.attr({
                rotation: angle
            })
        },
        translate: function(x, y) {
            return this.attr({
                tx: x,
                ty: y
            })
        },
        scale: function(x, y) {
            return this.attr({
                scaleX: x,
                scaleY: y
            })
        },
        skewX: function(val) {
            return this.attr({
                skewX: val
            })
        },
        skewY: function(val) {
            return this.attr({
                skewY: val
            })
        },
        zoomTo: function(value) {
            if (is(value, "number")) {
                this.__zoom = value
            }
            return this
        },
        zoomIn: function() {
            return this.zoomTo(this.__zoom + .1)
        },
        zoomOut: function() {
            return this.zoomTo(this.__zoom - .1)
        },
        setGlobalKeyEvents: function(v) {
            this.__globalkeyevents = !!v;
            return this
        },
        bind: function(name, fn, obj) {
            var shapes = obj || this._last,
                type;
            if (!USE_MOUSE_OVER_OUT && "mouseover mouseout".indexOf(name) != -1) {
                USE_MOUSE_OVER_OUT = true
            }
            if (is(name, string) && is(fn, object)) {
                for (type in fn) {
                    this[type](name, fn[type])
                }
            } else if (is(name, object)) {
                for (type in name) {
                    this[type](name[type])
                }
            } else if (shapes && !shapes.length) {
                addEvent(shapes, name, fn)
            } else {
                each(shapes, function(shape) {
                    addEvent(shape, name, fn)
                })
            }
            return this
        },
        beforeDraw: function(fn) {
            if (is(fn, func)) {
                this.__beforeDraw = fn
            }
            return this
        },
        afterDraw: function(fn) {
            if (is(fn, func)) {
                this.__afterDraw = fn
            }
            return this
        },
        clear: function(x, y, width, height) {
            x = x || 0;
            y = y || 0;
            width = width || this.cv.width;
            height = height || this.cv.height;
            this.ctx.fillStyle = this.background;
            this.ctx.fillRect(x, y, width, height);
            return this
        },
        draw: function() {
            var shape, i = 0,
                shapes = this._shapes;
            this.ctx.save();
            Cevent.__zoom = this.__zoom;
            this.__beforeDraw && this.__beforeDraw.call(this, this);
            if (!isIE && this.__cache && inDrag && !this.play && curDrag) {
                this.ctx.drawImage(this.__cache, 0, 0);
                curDrag.draw(this.ctx)
            } else {
                for (; shape = shapes[i++];) {
                    shape.draw(this.ctx)
                }
            }
            this.__afterDraw && this.__afterDraw.call(this, this);
            Cevent.__zoom = 1;
            this.ctx.restore();
            return this
        },
        redraw: function() {
            return this.clear().draw()
        },
        loop: function(fn) {
            var self = this,
                tdata = data(this.cv),
                play_flag;
            if (is(fn, func)) {
                tdata.loop = fn
            }
            fn = tdata.loop;
            play_flag = this.play = ++uuid;
            (function() {
                if (play_flag !== self.play) {
                    return
                }
                requestAnimFrame(arguments.callee);
                self.redraw();
                if (fn) {
                    self.ctx.save();
                    fn.call(self, self);
                    self.ctx.restore()
                }
                self.frameCount += 1
            })();
            return this
        },
        frameCount: 0,
        stop: function() {
            delete this.play;
            return this
        }
    };
    Cevent.fn.init.prototype = Cevent.prototype;
    Cevent.addEventListener = addEventListener;

    function makeLive(selector, fn) {
        var match = SELECTOR.exec(selector);
        return function(self, e) {
            if (match && this[match[1]] === match[2] || selector === "*") {
                fn.call(this, self, e)
            }
        }
    }
    each(("mousemove mouseover mouseout mousedown " + "mouseup click dblclick focus blur tap").split(" "), function(name) {
        Cevent.fn[name] = function(fn, match) {
            var obj;
            if (is(match, func)) {
                fn = makeLive(fn, match);
                obj = this.cv
            }
            return this.bind(name, fn, obj)
        }
    });
    each("keydown keypress keyup".split(" "), function(name) {
        Cevent.fn[name] = function(combi, fn) {
            if (!fn && is(combi, func)) {
                fn = combi;
                combi = "any"
            }
            combi = (combi + "").toLowerCase();
            return this.bind(combi, fn, data(this.cv, name))
        }
    });
    if (changeKeypress) {
        Cevent.fn.keypress = Cevent.fn.keydown
    }
    Cevent.fn.drag = function(handlers) {
        var start, move, end, afterMove, self, objs = [],
            selector, dragid = "Cevent-drag" + hash,
            shapes = this._last;
        if (is(handlers, string)) {
            selector = handlers;
            handlers = arguments[1]
        }
        if (handlers) {
            start = handlers.start;
            move = handlers.move;
            end = handlers.end;
            afterMove = handlers.afterMove
        }
        if (selector) {
            return this.mousedown(selector, mousedown).mouseup(selector, mouseup).mousemove(selector, mousemove)
        }
        if (shapes && !shapes.length) {
            shapes = [shapes]
        }
        each(shapes, function(shape) {
            if (!data(shape, dragid)) {
                data(shape, dragid, true);
                objs.push(shape)
            }
        });
        var a = Cevent(this.cv, objs).mousedown(mousedown).mouseup(mouseup).mousemove(mousemove);

        function mousedown(c, e) {
            if (c.LEFT || isTouchDevice) {
                curDrag = this;
                if (!c.play && !isIE && !inDrag) {
                    c.updateCache()
                }
            }
        }

        function mousemove(c, e) {
            if (this === curDrag) {
                if (!inDrag) {
                    if (start && start.call(this, c, e) === false) {
                        return curDrag = inDrag = null
                    } else {
                        inDrag = true
                    }
                }
                if (move) {
                    move.call(this, c, e)
                }
                this.rmove(c.x - c.lastX, c.y - c.lastY);
                if (afterMove) afterMove.call(this, c, e)
            }
        }

        function mouseup(c, e) {
            if (this === curDrag) {
                curDrag = inDrag = null;
                if (end) {
                    end.call(this, c, e)
                }
            }
        }
        return this
    };
    Cevent.registre = Cevent.register = function(name, Class) {
        name = name.toLowerCase();
        var constName = name.charAt(0).toUpperCase() + name.substring(1);
        this[constName] = Class;
        this.prototype[name] = function() {
            var shape = Class.apply(this, arguments);
            shape[""] = name;
            this._shapes.push(shape);
            this._last = shape;
            return this
        }
    };
    addEventListener(doc, "mousedown", function(e) {
        var target = e.target || e.srcElement;
        target = target.nodeName == "OBJECT" ? target.parentNode : target;
        if (!target[hash]) {
            currentCanvas = target
        }
    }, false);
    Cevent.isTouchDevice = isTouchDevice;
    window.Cevent = Cevent
})(this, document);
(function(Cevent, window) {
    "use strict";
    var math = Math,
        PI = math.PI,
        TWOPI = 2 * PI,
        DEGREE = PI / 180,
        sqrt = math.sqrt,
        pow = math.pow,
        cos = math.cos,
        sin = math.sin,
        round = math.round,
        abs = math.abs,
        acos = math.acos,
        atan2 = math.atan2,
        undefined, hasOwnProperty = Object.prototype.hasOwnProperty,
        slice = Array.prototype.slice,
        defaultStyle = {
            tx: 0,
            ty: 0,
            scaleX: 1,
            scaleY: 1,
            skewX: 0,
            skewY: 0,
            fill: "#000",
            stroke: "",
            lineWidth: 1,
            lineJoin: "miter",
            lineCap: "butt",
            alpha: 1,
            rotation: 0,
            composite: "source-over",
            shadowColor: "rgba(0, 0, 0, 0.0)",
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 0,
            fontStyle: "normal",
            fontWeight: "normal",
            fontSize: 10,
            fontFamily: "Arial"
        },
        cv = document.createElement("canvas"),
        testCtx = cv.getContext && cv.getContext("2d"),
        distance = function(p1, p2) {
            return sqrt(pow(p1.x - p2.x, 2) + pow(p1.y - p2.y, 2))
        },
        distanceToLine = function(x1, y1, x2, y2, point) {
            var deltaX = x2 - x1,
                deltaY = y2 - y1,
                closestPoint = {},
                u;
            if (deltaX === 0 && deltaY === 0) {
                return
            }
            u = ((point.x - x1) * deltaX + (point.y - y1) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
            if (u < 0) {
                closestPoint = {
                    x: x1,
                    y: y1
                }
            } else if (u > 1) {
                closestPoint = {
                    x: x2,
                    y: x2
                }
            } else {
                closestPoint = {
                    x: x1 + u * deltaX,
                    y: y1 + u * deltaY
                }
            }
            return distance(closestPoint, point)
        },
        rotate = function(x, y, angle) {
            angle = DEGREE * angle;
            return {
                x: x * cos(angle) - y * sin(angle),
                y: x * sin(angle) + y * cos(angle)
            }
        },
        extend = function(orig, obj) {
            var attr;
            for (attr in obj) {
                if (hasOwnProperty.call(obj, attr)) {
                    orig[attr] = obj[attr]
                }
            }
        },
        Shape = Class.extend({
            init: function(x, y) {
                this.x = x || 0;
                this.y = y || 0;
                extend(this, defaultStyle)
            },
            position: function() {
                var p = rotate(this.x * this.scaleX, this.y * this.scaleY, this.rotation);
                return {
                    x: p.x + this.tx,
                    y: p.y + this.ty
                }
            },
            rmove: function(x, y) {
                this.tx += x;
                this.ty += y
            },
            attr: function(attrs, value) {
                var attr;
                if (typeof attrs == "string") {
                    this[attrs] = value
                } else {
                    for (attr in attrs) {
                        this[attr] = attrs[attr]
                    }
                }
                return this
            },
            applyStyle: function(ctx) {
                var shadowBlur = this.shadowBlur,
                    shadowOffsetX = this.shadowOffsetX,
                    shadowOffsetY = this.shadowOffsetY;
                ctx.fillStyle = this.fill;
                ctx.globalAlpha = this.alpha;
                ctx.globalCompositeOperation = this.composite;
                if (this.stroke) {
                    ctx.strokeStyle = this.stroke;
                    ctx.lineWidth = this.lineWidth
                }
                if (shadowOffsetX || shadowOffsetY || shadowBlur) {
                    ctx.shadowColor = this.shadowColor;
                    ctx.shadowOffsetX = shadowOffsetX;
                    ctx.shadowOffsetY = shadowOffsetY;
                    ctx.shadowBlur = shadowBlur
                }
            },
            setTransform: function(ctx) {
                var zoom = Cevent.__zoom,
                    scaleX = this.scaleX * zoom,
                    scaleY = this.scaleY * zoom,
                    skewX = this.skewX * zoom,
                    skewY = this.skewY * zoom,
                    angle = this.rotation * DEGREE,
                    s = sin(angle),
                    c = cos(angle),
                    dx = this.tx * zoom,
                    dy = this.ty * zoom,
                    m11 = c * scaleX - s * skewY,
                    m21 = c * skewX - s * scaleY,
                    m12 = s * scaleX + c * skewY,
                    m22 = s * skewX + c * scaleY;
                ctx.setTransform(m11, m12, m21, m22, dx, dy)
            },
            draw: function(ctx) {
                throw new Error("El mÃ©todo draw no se ha implementado")
            },
            fill_or_stroke: function(ctx) {
                if (this.fill) {
                    ctx.fill()
                }
                if (this.stroke) {
                    ctx.stroke()
                }
            },
            hitTest: function(point) {
                if (testCtx && testCtx.isPointInPath) {
                    this.draw(testCtx);
                    testCtx.setTransform(1, 0, 0, 1, 0, 0);
                    return testCtx.isPointInPath(point.x, point.y)
                } else {
                    throw Error("MÃ©todo isPointInPath no soportado: Necesita FlashCanvasPro")
                }
            }
        }),
        Rect = Shape.extend({
            init: function(x, y, width, height, radius) {
                this.r = radius || 0;
                this.w = width || 5;
                this.h = height || width;
                this._super(x, y)
            },
            draw: function(ctx) {
                var x = this.x,
                    y = this.y,
                    w = this.w,
                    h = this.h;
                this.applyStyle(ctx);
                this.setTransform(ctx);
                ctx.beginPath();
                if (this.r) {
                    Cevent.setContext(ctx).polygon(x, y, x + w, y, x + w, y + h, x, y + h, this.r)
                } else {
                    ctx.rect(x, y, round(w), round(h))
                }
                ctx.closePath();
                if (this.fill) {
                    ctx.fill()
                }
                if (this.stroke) {
                    ctx.stroke()
                }
            },
            hitTest: function(point) {
                if (this.skewX || this.skewY || this.r) {
                    return this._super(point)
                }
                var thisPos = this.position(),
                    mousePos = rotate(point.x - thisPos.x, point.y - thisPos.y, -this.rotation);
                return mousePos.x >= 0 && mousePos.x <= this.w * this.scaleX && mousePos.y >= 0 && mousePos.y <= this.h * this.scaleY
            }
        }),
        Text = Rect.extend({
            init: function(x, y, text) {
                this.setText(text);
                this._super(x, y, this.w, this.h)
            },
            applyStyle: function(ctx) {
                ctx.font = this.fontStyle + " " + this.fontWeight + " " + this.fontSize + "px " + this.fontFamily;
                this.h = this.fontSize;
                this.w = ctx.measureText(this.text).width;
                this._super(ctx)
            },
            setText: function(text) {
                this.text = text + ""
            },
            draw: function(ctx) {
                this.applyStyle(ctx);
                this.setTransform(ctx);
                if (this.fill) {
                    ctx.fillText(this.text, this.x, this.y + this.h)
                }
                if (this.stroke) {
                    ctx.strokeText(this.text, this.x, this.y + this.h)
                }
            },
            hitTest: function(point) {
                if (this.skewX || this.skewY && testCtx && testCtx.isPointInPath) {
                    this.setTransform(testCtx);
                    testCtx.beginPath();
                    testCtx.rect(this.x, this.y, this.w, this.h);
                    testCtx.closePath();
                    return testCtx.isPointInPath(point.x, point.y)
                }
                return this._super(point)
            }
        }),
        imageCache = {},
        Img = Rect.extend({
            init: function(x, y, src) {
                this.setImg(src);
                this._super(x, y, this.img.width, this.img.height)
            },
            setImg: function(img) {
                if (imageCache[img]) {
                    this.img = imageCache[img];
                    this.src = this.img.src;
                    return
                }
                if (img.nodeName == "IMG") {
                    this.img = img
                } else {
                    img += "";
                    this.img = imageCache[img] = new Image;
                    this.img.src = img
                }
                this.img.onload = function() {
                    Cevent.forse_redraw()
                };
                this.src = this.img.src
            },
            draw: function(ctx) {
                var x = this.x,
                    y = this.y;
                this.w = this.img.width;
                this.h = this.img.height;
                this.applyStyle(ctx);
                this.setTransform(ctx);
                if (ctx === testCtx) {
                    ctx.beginPath();
                    ctx.rect(x, y, round(this.w), round(this.h));
                    ctx.closePath()
                } else {
                    ctx.drawImage(this.img, x, y)
                }
            }
        }),
        Ellipse = Rect.extend({
            draw: function(ctx) {
                var x = this.x,
                    y = this.y,
                    w = this.w,
                    h = this.h,
                    C = .5522847498307933,
                    c_x = C * w,
                    c_y = C * h;
                this.applyStyle(ctx);
                this.setTransform(ctx);
                ctx.beginPath();
                ctx.moveTo(x + w, y);
                ctx.bezierCurveTo(x + w, y - c_y, x + c_x, y - h, x, y - h);
                ctx.bezierCurveTo(x - c_x, y - h, x - w, y - c_y, x - w, y);
                ctx.bezierCurveTo(x - w, y + c_y, x - c_x, y + h, x, y + h);
                ctx.bezierCurveTo(x + c_x, y + h, x + w, y + c_y, x + w, y);
                ctx.closePath();
                if (this.fill) {
                    ctx.fill()
                }
                if (this.stroke) {
                    ctx.stroke()
                }
            },
            hitTest: Shape.prototype.hitTest
        }),
        Arc = Shape.extend({
            init: function(x, y, radius, startAngle, endAngle, antiClockWise) {
                this.clockwise = antiClockWise;
                this.endAngle = endAngle;
                this.startAngle = startAngle;
                this.r = radius;
                this._super(x, y)
            },
            draw: function(ctx) {
                var x = this.x,
                    y = this.y;
                this.applyStyle(ctx);
                this.setTransform(ctx);
                ctx.beginPath();
                ctx.arc(x, y, round(this.r), this.startAngle || PI * 2, this.endAngle || 0, !!this.clockwise);
                ctx.lineTo(x, y);
                ctx.closePath();
                if (this.fill) {
                    ctx.fill()
                }
                if (this.stroke) {
                    ctx.stroke()
                }
            }
        }),
        Circle = Shape.extend({
            init: function(x, y, radius) {
                this.r = radius || 5;
                this._super(x, y)
            },
            draw: function(ctx) {
                var x = this.x,
                    y = this.y;
                this.applyStyle(ctx);
                this.setTransform(ctx);
                ctx.beginPath();
                ctx.arc(x, y, round(this.r), 0, PI * 2, true);
                ctx.closePath();
                if (this.fill) {
                    ctx.fill()
                }
                if (this.stroke) {
                    ctx.stroke()
                }
            },
            hitTest: function(point) {
                if (this.skewX || this.skewY || this.scaleX !== this.scaleY) {
                    return this._super(point)
                }
                var lineWidth = !!this.stroke && this.lineWidth,
                    thisPos = this.position();
                return distance(point, thisPos) <= (this.r + lineWidth) * this.scaleX
            }
        }),
        Line = Shape.extend({
            init: function(x1, y1, x2, y2) {
                this.x2 = x2;
                this.y2 = y2;
                this._super(x1, y1);
                this.stroke = "#000"
            },
            rmove: function(x, y) {
                this.x += x;
                this.y += y;
                this.x2 += x;
                this.y2 += y
            },
            applyStyle: function(ctx) {
                ctx.lineJoin = this.lineJoin;
                ctx.lineCap = this.lineCap;
                this._super(ctx)
            },
            draw: function(ctx) {
                this.applyStyle(ctx);
                this.setTransform(ctx);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x2, this.y2);
                ctx.stroke()
            },
            hitTest: function(point) {
                return distanceToLine(this.x, this.y, this.x2, this.y2, point) <= this.lineWidth + 2
            }
        }),
        currentX, currentY, startSubpathX, startSubpathY, _lastCCP = null,
        _lastQCP = null,
        _pathIsEmpty = false,
        SVGPATTERN = /[MmLlZzHhVvCcQqSsTtAa]\s*([\-+]?(?:\d+[.]?\d*|[.]\d+)(?:[Ee][\-+]?\d+)?[,\s]*)*/g,
        NUMBER = /[\-+]?(?:\d+[.]?\d*|[.]\d+)(?:[Ee][\-+]?\d+)?/g,
        angleBetweenVectors = function(x1, y1, x2, y2) {
            var dotproduct = x1 * x2 + y1 * y2,
                d1 = sqrt(x1 * x1 + y1 * y1),
                d2 = sqrt(x2 * x2 + y2 * y2),
                x = dotproduct / (d1 * d2),
                angle, sign;
            if (x > 1) {
                x = 1
            } else if (x < -1) {
                x = -1
            }
            angle = abs(acos(x));
            sign = x1 * y2 - y1 * x2;
            return sign === abs(sign) ? angle : -angle
        },
        rotatePoint = function(x, y, angle) {
            return [x * cos(angle) - y * sin(angle), y * cos(angle) + x * sin(angle)]
        },
        ensure = function(self, x, y) {
            if (_pathIsEmpty) {
                self.ctx.moveTo(x, y)
            }
        },
        setCurrent = function(x, y) {
            currentX = x;
            currentY = y;
            _lastCCP = null;
            _lastQCP = null;
            _pathIsEmpty = false
        },
        checkcurrent = function() {
            if (currentX === undefined) {
                throw new Error("No current point; can't use relative coordinates")
            }
        },
        check = function(args, n, m, min) {
            if (n !== (m ? args.length % m : args.length) || args.length < min) {
                throw new Error("wrong number of arguments")
            }
        },
        M = function(x, y) {
            this.ctx.moveTo(x, y);
            setCurrent(x, y);
            startSubpathX = x;
            startSubpathY = y;
            if (arguments.length > 2) {
                L.apply(this, slice.call(arguments, 2))
            }
            return this
        },
        m = function(x, y) {
            if (_pathIsEmpty) {
                currentX = currentY = 0
            }
            checkcurrent();
            x += currentX;
            y += currentY;
            this.ctx.moveTo(x, y);
            setCurrent(x, y);
            startSubpathX = x;
            startSubpathY = y;
            if (arguments.length > 2) {
                l.apply(this, slice.call(arguments, 2))
            }
            return this
        },
        L = function(x, y) {
            var i, l = arguments.length;
            check(arguments, 0, 2, 2);
            ensure(this, x, y);
            this.ctx.lineTo(x, y);
            for (i = 2; i < l; i += 2) {
                this.ctx.lineTo(x = arguments[i], y = arguments[i + 1])
            }
            setCurrent(x, y);
            return this
        },
        l = function(x, y) {
            var i, cx = currentX,
                cy = currentY,
                l = arguments.length;
            check(arguments, 0, 2, 2);
            checkcurrent();
            for (i = 0; i < l; i += 2) {
                this.ctx.lineTo(cx += arguments[i], cy += arguments[i + 1])
            }
            setCurrent(cx, cy);
            return this
        },
        z = function() {
            this.ctx.closePath();
            setCurrent(this, startSubpathX, startSubpathY);
            return this
        },
        H = function(x) {
            var i, l = arguments.length;
            checkcurrent();
            for (i = 0; i < l; i++) {
                L.call(this, arguments[i], currentY)
            }
            return this
        },
        h = function(x) {
            var i, n = arguments.length;
            for (i = 0; i < n; i++) {
                l.call(this, arguments[i], 0)
            }
            return this
        },
        V = function(y) {
            var i, l = arguments.length;
            checkcurrent();
            for (i = 0; i < l; i++) {
                L.call(this, currentX, arguments[i])
            }
            return this
        },
        v = function(y) {
            var i, n = arguments.length;
            for (i = 0; i < n; i++) {
                l.call(this, 0, arguments[i])
            }
            return this
        },
        C = function(cx1, cy1, cx2, cy2, x, y) {
            var i, a = arguments,
                l = arguments.length;
            check(a, 0, 6, 6);
            ensure(this, cx1, cx2);
            this.ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
            for (i = 6; i < l; i += 6) {
                this.ctx.bezierCurveTo(a[i], a[i + 1], cx2 = a[i + 2], cy2 = a[i + 3], x = a[i + 4], y = a[i + 5])
            }
            setCurrent(x, y);
            _lastCCP = [cx2, cy2];
            return this
        },
        c = function(cx1, cy1, cx2, cy2, x, y) {
            var i, a = arguments,
                l = a.length,
                x0 = currentX,
                y0 = currentY;
            check(a, 0, 6, 6);
            checkcurrent();
            for (i = 0; i < l; i += 6) {
                this.ctx.bezierCurveTo(x0 + a[i], y0 + a[i + 1], cx2 = x0 + a[i + 2], cy2 = y0 + a[i + 3], x0 += a[i + 4], y0 += a[i + 5])
            }
            setCurrent(x0, y0);
            _lastCCP = [cx2, cy2];
            return this
        },
        Q = function(cx, cy, x, y) {
            var i, a = arguments,
                l = a.length;
            check(arguments, 0, 4, 4);
            ensure(this, cx, cy);
            this.ctx.quadraticCurveTo(cx, cy, x, y);
            for (i = 4; i < l; i += 4) {
                this.ctx.quadraticCurveTo(cx = a[i], cy = a[i + 1], x = a[i + 2], y = a[i + 3])
            }
            setCurrent(x, y);
            _lastQCP = [cx, cy];
            return this
        },
        q = function(cx, cy, x, y) {
            var i, a = arguments,
                l = a.length,
                x0 = currentX,
                y0 = currentY;
            check(arguments, 0, 4, 4);
            checkcurrent();
            for (i = 0; i < l; i += 4) {
                this.ctx.quadraticCurveTo(cx = x0 + a[i], cy = y0 + a[i + 1], x0 += a[i + 2], y0 += a[i + 3])
            }
            setCurrent(x0, y0);
            _lastQCP = [cx, cy];
            return this
        },
        S = function() {
            if (!_lastCCP) {
                throw new Error("Last command was not a cubic bezier")
            }
            var i, a = arguments,
                l = a.length,
                x0 = currentX,
                y0 = currentY,
                cx0 = _lastCCP[0],
                cy0 = _lastCCP[1],
                cx1, cx2, cy1, cy2, x, y;
            check(arguments, 0, 4, 4);
            checkcurrent();
            for (i = 0; i < l; i += 4) {
                cx1 = x0 + (x0 - cx0);
                cy1 = y0 + (y0 - cy0);
                cx2 = a[i];
                cy2 = a[i + 1];
                x = a[i + 2];
                y = a[i + 3];
                this.ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
                x0 = x;
                y0 = y;
                cx0 = cx2;
                cy0 = cy2
            }
            setCurrent(x0, y0);
            _lastCCP = [cx0, cy0];
            return this
        },
        s = function() {
            if (!_lastCCP) {
                throw new Error("Last command was not a cubic bezier")
            }
            var i, a = arguments,
                l = a.length,
                x0 = currentX,
                y0 = currentY,
                cx0 = _lastCCP[0],
                cy0 = _lastCCP[1],
                cx1, cx2, cy1, cy2, x, y;
            check(arguments, 0, 4, 4);
            checkcurrent();
            for (i = 0; i < l; i += 4) {
                cx1 = x0 + (x0 - cx0);
                cy1 = y0 + (y0 - cy0);
                cx2 = x0 + a[i];
                cy2 = y0 + a[i + 1];
                x = x0 + a[i + 2];
                y = y0 + a[i + 3];
                this.ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
                x0 = x;
                y0 = y;
                cx0 = cx2;
                cy0 = cy2
            }
            setCurrent(x0, y0);
            _lastCCP = [cx0, cy0];
            return this
        },
        T = function() {
            if (!_lastQCP) {
                throw new Error("Last command was not a cubic bezier")
            }
            var i, a = arguments,
                l = arguments.length,
                x0 = currentX,
                y0 = currentY,
                cx0 = _lastQCP[0],
                cy0 = _lastQCP[1],
                cx, cy, x, y;
            check(arguments, 0, 2, 2);
            checkcurrent();
            for (i = 0; i < l; i += 2) {
                cx = x0 + (x0 - cx0);
                cy = y0 + (y0 - cy0);
                x = arguments[i];
                y = arguments[i + 1];
                this.ctx.quadraticCurveTo(cx, cy, x, y);
                x0 = x;
                y0 = y;
                cx0 = cx;
                cy0 = cy
            }
            setCurrent(x0, y0);
            _lastQCP = [cx0, cy0];
            return this
        },
        t = function() {
            if (!_lastQCP) {
                throw new Error("Last command was not a cubic bezier")
            }
            var i, a = arguments,
                l = a.length,
                x0 = currentX,
                y0 = currentY,
                cx0 = _lastQCP[0],
                cy0 = _lastQCP[1],
                cx, cy, x, y;
            check(arguments, 0, 2, 2);
            checkcurrent();
            for (i = 0; i < l; i += 2) {
                cx = x0 + (x0 - cx0);
                cy = y0 + (y0 - cy0);
                x = x0 + arguments[i];
                y = y0 + arguments[i + 1];
                this.ctx.quadraticCurveTo(cx, cy, x, y);
                x0 = x;
                y0 = y;
                cx0 = cx;
                cy0 = cy
            }
            setCurrent(x0, y0);
            _lastQCP = [cx0, cy0];
            return this
        },
        A = function(rx, ry, rotation, big, clockwise, x, y) {
            if (!rx || !ry) {
                return L.call(this, x, y)
            }
            big = !!big;
            clockwise = !!clockwise;
            checkcurrent();
            var x1 = currentX,
                y1 = currentY,
                x2 = x,
                y2 = y,
                phi = rotation * DEGREE,
                sinphi = sin(phi),
                cosphi = cos(phi),
                tx = (x1 - x2) / 2,
                ty = (y1 - y2) / 2,
                x1$ = cosphi * tx + sinphi * ty,
                y1$ = -sinphi * tx + cosphi * ty,
                lambda, cx$, cy$, cx, cy, theta1, theta2, dtheta;
            rx = abs(rx);
            ry = abs(ry);
            lambda = x1$ * x1$ / (rx * rx) + y1$ * y1$ / (ry * ry);
            if (lambda > 1) {
                rx *= sqrt(lambda);
                ry *= sqrt(lambda);
                cx$ = cy$ = 0
            } else {
                var rxrx = rx * rx,
                    ryry = ry * ry,
                    x1x1$ = x1$ * x1$,
                    y1y1$ = y1$ * y1$,
                    t = rxrx * y1y1$ + ryry * x1x1$;
                t = sqrt(rxrx * ryry / t - 1);
                if (big === clockwise) {
                    t = -t
                }
                cx$ = t * rx * y1$ / ry;
                cy$ = -t * ry * x1$ / rx
            }
            cx = cosphi * (cx$ - sinphi) * (cy$ + (x1 + x2) / 2);
            cy = sinphi * (cx$ + cosphi) * (cy$ + (y1 + y2) / 2);
            tx = (x1$ - cx$) / rx;
            ty = (y1$ - cy$) / ry;
            theta1 = angleBetweenVectors(1, 0, tx, ty);
            dtheta = angleBetweenVectors(tx, ty, (-x1$ - cx$) / rx, (-y1$ - cy$) / ry);
            if (clockwise && dtheta < 0) {
                dtheta += TWOPI
            } else if (!clockwise && dtheta > 0) {
                dtheta -= TWOPI
            }
            theta2 = theta1 + dtheta;
            this.ellipse(cx, cy, rx, ry, phi, theta1, theta2, !clockwise);
            return this
        },
        a = function(rx, ry, rotation, big, clockwise, x, y) {
            checkcurrent();
            A.call(this, rx, ry, rotation, big, clockwise, x + currentX, y + currentY);
            return this
        },
        ellipse = function(cx, cy, rx, ry, rotation, sa, ea, anticlockwise) {
            rotation = rotation || 0;
            sa = sa || 0;
            ea = ea === undefined ? TWOPI : ea;
            var sp = rotatePoint(rx * cos(sa), ry * sin(sa), rotation),
                sx = cx + sp[0],
                sy = cy + sp[1],
                ep = rotatePoint(rx * cos(ea), ry * sin(ea), rotation),
                ex = cx + ep[0],
                ey = cy + ep[1];
            ensure(this, sx, sy);
            this.ctx.translate(cx, cy);
            this.ctx.rotate(rotation);
            this.ctx.scale(rx / ry, 1);
            this.ctx.arc(0, 0, ry, sa, ea, !!anticlockwise);
            this.ctx.scale(ry / rx, 1);
            this.ctx.rotate(-rotation);
            this.ctx.translate(-cx, -cy);
            setCurrent(ex, ey);
            return this
        },
        polygon = function() {
            var i, a = arguments,
                l = a.length;
            if (l < 6) {
                throw new Error("not enough arguments")
            }
            if (l % 2 === 0) {
                this.ctx.moveTo(a[0], a[1]);
                for (i = 2; i < l; i += 2) {
                    this.ctx.lineTo(a[i], a[i + 1])
                }
            } else {
                var radius = a[l - 1],
                    n = (l - 1) / 2,
                    x0 = (a[n * 2 - 2] + a[0]) / 2,
                    y0 = (a[n * 2 - 1] + a[1]) / 2,
                    temp_x, temp_y;
                this.ctx.moveTo(x0, y0);
                for (i = 0; i < n - 1; i++) {
                    this.ctx.arcTo(temp_x = a[i * 2], temp_y = a[i * 2 + 1], a[i * 2 + 2], a[i * 2 + 3], radius, x0, y0);
                    x0 = temp_x;
                    y0 = temp_y
                }
                this.ctx.arcTo(a[n * 2 - 2], a[n * 2 - 1], a[0], a[1], radius, x0, y0)
            }
            return this
        },
        parseSVG = function(svg) {
            var matches = svg.match(SVGPATTERN),
                match, parts, args, i, j, path = [];
            if (!matches) {
                throw new Error("Bad path: " + svg)
            }
            for (i = 0; match = matches[i]; i++) {
                args = [];
                args.cmd = match.charAt(0);
                parts = match.match(NUMBER) || [];
                for (j = 0; j < parts.length; j++) {
                    args[j] = +parts[j]
                }
                path.push(args)
            }
            return path
        },
        Path = Shape.extend({
            init: function(svgpath) {
                this.svgpath = parseSVG(svgpath);
                this._super(0, 0);
                if (this.svgpath[0].cmd.toLowerCase() == "m") {
                    this.x = this.svgpath[0][0];
                    this.y = this.svgpath[0][1]
                }
            },
            draw: function(ctx) {
                var svgpath = this.svgpath,
                    i, l;
                this.applyStyle(ctx);
                this.setTransform(ctx);
                ctx.beginPath();
                Cevent.setContext(ctx);
                for (i = 0, l = svgpath.length; i < l; i++) {
                    Cevent[svgpath[i].cmd].apply(Cevent, svgpath[i])
                }
                if (this.fill) {
                    ctx.fill()
                }
                if (this.stroke) {
                    ctx.stroke()
                }
            }
        });
    extend(Cevent, {
        distance: distance,
        __zoom: 1,
        Shape: Shape,
        setContext: function(ctx) {
            this.ctx = ctx;
            setCurrent(0, 0);
            ctx.beginPath();
            return this
        },
        polygon: polygon,
        ellipse: ellipse,
        M: M,
        m: m,
        L: L,
        l: l,
        H: H,
        h: h,
        V: V,
        v: v,
        C: C,
        c: c,
        S: S,
        s: s,
        Q: Q,
        q: q,
        T: T,
        t: t,
        A: A,
        a: a,
        Z: z,
        z: z
    });
    (function() {
        if (!testCtx) {
            return
        }
        var rect = Rect(40, 40, 40, 40, 5);
        rect.draw(testCtx);
        if (!testCtx.getImageData(79, 60, 1, 1).data[3]) {
            var originalArcTo = CanvasRenderingContext2D.prototype.arcTo;
            var dist2 = function(x0, y0, x1, y1) {
                return (x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1)
            };
            CanvasRenderingContext2D.prototype.arcTo = function(x1, y1, x2, y2, radius, x0, y0) {
                if (isNaN(x0 + y0)) {
                    return originalArcTo.apply(this, arguments);

                }
                var dir, a2, b2, c2, cosx, sinx, d, anx, any, bnx, bny, x3, y3, x4, y4, ccw, cx, cy, a0, a1;
                if (x1 == x0 && y1 == y0 || x1 == x2 && y1 == y2 || radius == 0) {
                    this.lineTo(x1, y1);
                    return
                }
                dir = (x2 - x1) * (y0 - y1) + (y2 - y1) * (x1 - x0);
                if (dir == 0) {
                    this.lineTo(x1, y1);
                    return
                }
                a2 = dist2(x0, y0, x1, y1);
                b2 = dist2(x1, y1, x2, y2);
                c2 = dist2(x0, y0, x2, y2);
                cosx = (a2 + b2 - c2) / (2 * sqrt(a2 * b2));
                a2 = sqrt(a2);
                b2 = sqrt(b2);
                sinx = sqrt(1 - cosx * cosx);
                d = radius * sinx / (1 - cosx);
                anx = (x1 - x0) / a2;
                any = (y1 - y0) / a2;
                bnx = (x1 - x2) / b2;
                bny = (y1 - y2) / b2;
                x3 = x1 - anx * d;
                y3 = y1 - any * d;
                x4 = x1 - bnx * d;
                y4 = y1 - bny * d;
                ccw = dir < 0;
                cx = x3 + any * radius * (ccw ? 1 : -1);
                cy = y3 - anx * radius * (ccw ? 1 : -1);
                a0 = atan2(y3 - cy, x3 - cx);
                a1 = atan2(y4 - cy, x4 - cx);
                this.lineTo(x3, y3);
                this.arc(cx, cy, radius, a0, a1, ccw)
            }
        }
    })();
    if (window.FlashCanvas) {
        document.body.appendChild(cv);
        FlashCanvas.initElement(cv);
        testCtx = cv.getContext("2d");
        cv.style.display = "none"
    }
    if (testCtx) {
        testCtx.fill = testCtx.stroke = function() {}
    }
    Cevent.register("image", Img);
    Cevent.register("circle", Circle);
    Cevent.register("arc", Arc);
    Cevent.register("ellipse", Ellipse);
    Cevent.register("rect", Rect);
    Cevent.register("text", Text);
    Cevent.register("line", Line);
    Cevent.register("path", Path)
})(Cevent, this);
