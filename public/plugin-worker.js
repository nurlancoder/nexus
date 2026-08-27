(function() {
  "use strict";

  var _postMessage, _onMessage;
  if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof self.addEventListener === "function") {
    _postMessage = function(msg) { self.postMessage(msg); };
    _onMessage = function(fn) { self.addEventListener("message", function(e) { fn(e.data); }); };
  } else if (typeof require === "function") {
    var pp = require("worker_threads").parentPort;
    _postMessage = function(msg) { pp.postMessage(msg); };
    _onMessage = function(fn) { pp.on("message", fn); };
  } else {
    throw new Error("No communication channel available");
  }

  var _nextId = 1;
  var _pending = {};
  var _commands = {};
  var _handlers = {};
  var _nextHandlerId = 1;
  var _initialized = false;

  function callHost(method, args) {
    return new Promise(function(resolve, reject) {
      var id = _nextId++;
      _pending[id] = { resolve: resolve, reject: reject };
      _postMessage({ type: "call", id: id, method: method, args: args || [] });
    });
  }

  function initPlugin(source) {
    var nx = {
      registerCommand: function(spec) {
        _commands[spec.id] = spec.run;
        _postMessage({ type: "register", id: spec.id, title: spec.title });
      },
      registerKeybinding: function(spec, commandId) {
        _postMessage({ type: "register-keybinding", spec: spec, commandId: commandId });
      },
      on: function(event, handler) {
        var handlerId = _nextHandlerId++;
        _handlers[handlerId] = handler;
        _postMessage({ type: "subscribe", event: event, handlerId: handlerId });
      },
      getActiveNote: function() {
        return callHost("getActiveNote");
      },
      readNote: function(path) {
        return callHost("readNote", [path]);
      },
      writeNote: function(path, content) {
        return callHost("writeNote", [path, content]);
      },
      log: function(message) {
        _postMessage({ type: "log", message: message });
      },
      today: function() {
        return new Date().toISOString().slice(0, 10);
      }
    };

    try {
      var fn = new Function("nx", '"use strict";\n' + source);
      fn(nx);
      _postMessage({ type: "ready" });
    } catch(e) {
      _postMessage({ type: "error", error: String(e) });
    }
  }

  _onMessage(function(msg) {
    if (!_initialized) {
      if (msg.type === "init") {
        _initialized = true;
        initPlugin(msg.source);
        return;
      }
      return;
    }

    if (msg.type === "response") {
      var entry = _pending[msg.id];
      if (entry) {
        delete _pending[msg.id];
        if (msg.error !== undefined) { entry.reject(new Error(msg.error)); }
        else { entry.resolve(msg.result); }
      }
      return;
    }

    if (msg.type === "run-command") {
      var cmdFn = _commands[msg.commandId];
      if (cmdFn) {
        try { cmdFn(); } catch(e) {
          _postMessage({ type: "log", message: "command error: " + String(e) });
        }
      }
      return;
    }

    if (msg.type === "event-deliver") {
      var h = _handlers[msg.handlerId];
      if (h) {
        try { h(msg.detail); } catch(e) {
          _postMessage({ type: "log", message: "event error: " + String(e) });
        }
      }
      return;
    }
  });
})();
