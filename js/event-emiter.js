"use strict";
var EventEmitter = function() {};
EventEmitter.prototype.setMaxListeners = function(a) {
    this._events || (this._events = {}), this._events.maxListeners = a
}, Array.isArray = Array.isArray || function(a) {
    return a.sort && a.length && a.slice
}, EventEmitter.prototype.emit = function(a) {
    if (a === "error")
        if (!this._events || !this._events.error || Array.isArray(this._events.error) && !this._events.error.length) throw arguments[1] instanceof Error ? arguments[1] : new Error("Uncaught, unspecified 'error' event.");
    if (!this._events) return !1;
    var b = this._events[a];
    if (!b) return !1;
    if (typeof b == "function") {
        switch (arguments.length) {
            case 1:
                b.call(this);
                break;
            case 2:
                b.call(this, arguments[1]);
                break;
            case 3:
                b.call(this, arguments[1], arguments[2]);
                break;
            default:
                var c = Array.prototype.slice.call(arguments, 1);
                b.apply(this, c)
        }
        return !0
    }
    if (Array.isArray(b)) {
        var c = Array.prototype.slice.call(arguments, 1),
            d = b.slice();
        for (var e = 0, f = d.length; e < f; e++) d[e].apply(this, c);
        return !0
    }
    return !1
}, EventEmitter.prototype.publish = EventEmitter.prototype.emit, EventEmitter.prototype.addListener = function(a, b) {
    if ("function" != typeof b) throw new Error("addListener only takes instances of Function");
    this._events || (this._events = {}), this.emit("newListener", a, b);
    if (!this._events[a]) this._events[a] = b;
    else if (Array.isArray(this._events[a])) {
        this._events[a].push(b);
        if (!this._events[a].warned) {
            var c;
            this._events.maxListeners !== undefined ? c = this._events.maxListeners : c = 10, c && c > 0 && this._events[a].length > c && (this._events[a].warned = !0, console.error("(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.", this._events[a].length), console.trace())
        }
    } else this._events[a] = [this._events[a], b];
    return this
}, EventEmitter.prototype.on = EventEmitter.prototype.subscribe = EventEmitter.prototype.addListener, EventEmitter.prototype.once = function(a, b) {
    function d() {
        c.removeListener(a, d), b.apply(this, arguments)
    }
    if ("function" != typeof b) throw new Error(".once only takes instances of Function");
    var c = this;
    return d.listener = b, c.on(a, d), this
}, EventEmitter.prototype.removeListener = function(a, b) {
    if ("function" != typeof b) throw new Error("removeListener only takes instances of Function");
    if (!this._events || !this._events[a]) return this;
    var c = this._events[a];
    if (Array.isArray(c)) {
        var d = -1;
        for (var e = 0, f = c.length; e < f; e++)
            if (c[e] === b || c[e].listener && c[e].listener === b) {
                d = e;
                break
            } if (d < 0) return this;
        c.splice(d, 1), c.length == 0 && delete this._events[a]
    } else(c === b || c.listener && c.listener === b) && delete this._events[a];
    return this
}, EventEmitter.prototype.unsubscribe = EventEmitter.prototype.removeListener, EventEmitter.prototype.removeAllListeners = function(a) {
    return arguments.length === 0 ? (this._events = {}, this) : (a && this._events && this._events[a] && (this._events[a] = null), this)
}, EventEmitter.prototype.listeners = function(a) {
    return this._events || (this._events = {}), this._events[a] || (this._events[a] = []), Array.isArray(this._events[a]) || (this._events[a] = [this._events[a]]), this._events[a]
}, EventEmitter.mixin = function(a) {
    for (var b in EventEmitter.prototype) a.prototype[b] || (a.prototype[b] = EventEmitter.prototype[b])
};
