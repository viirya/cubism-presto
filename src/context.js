cubism.context = function() {
  var context = new cubism_context,
      step = 1e4, // ten seconds, in milliseconds
      refreshStep = 1e3,
      size = 1440, // four hours at ten seconds, in pixels
      start0, stop0, // the start and stop for the previous change event
      start1, stop1, // the start and stop for the next prepare event
      serverDelay = 5e3,
      clientDelay = 5e3,
      event = d3.dispatch("prepare", "beforechange", "change", "focus"),
      scale = context.scale = d3.time.scale().range([0, size]),
      timeout,
      focus;

  var now = Date.now();
  var pseudoNow = null;
  var nowPseudoNowDiff = 0;

  function update() {
    var now = context.getNow();
    stop0 = new Date(Math.floor((now - serverDelay - clientDelay) / step) * step);
    start0 = new Date(stop0 - size * step);
    stop1 = new Date(Math.floor((now - serverDelay) / step) * step);
    start1 = new Date(stop1 - size * step);
    scale.domain([start0, stop0]);
    return context;
  }

  context.getNow = function() {
    var cur_now = now;
    if (pseudoNow != null) {
      cur_now = cur_now - nowPseudoNowDiff;
    }
    return cur_now;
  }

  setTimeout(function increaseTime() {
    now += step;
    setTimeout(increaseTime, 1e3);
  });

  context.start = function() {
    var now = context.getNow();
 
    if (timeout) clearTimeout(timeout);
    var delay = +stop1 + serverDelay - now;

    // If we're too late for the first prepare event, skip it.
    if (delay < clientDelay) delay += step;
    timeout = setTimeout(function prepare() {
      stop1 = new Date(Math.floor((context.getNow() - serverDelay) / step) * step);
      start1 = new Date(stop1 - size * step);
      event.prepare.call(context, start1, stop1);

      setTimeout(function() {
        scale.domain([start0 = start1, stop0 = stop1]);
        event.beforechange.call(context, start1, stop1);
        event.change.call(context, start1, stop1);
        event.focus.call(context, focus);
      }, clientDelay);

      timeout = setTimeout(prepare, refreshStep);
    }, delay);
    return context;
  };

  context.pseudoNow = function(_) {
    if (!arguments.length) return pseudoNow;
    pseudoNow = _.getTime();
    nowPseudoNowDiff = Date.now() - pseudoNow;
    return update();
  }

  context.stop = function() {
    timeout = clearTimeout(timeout);
    return context;
  };

  timeout = setTimeout(context.start, 10);

  // Set or get the step interval in milliseconds.
  // Defaults to ten seconds.
  context.step = function(_) {
    if (!arguments.length) return step;
    step = +_;
    return update();
  };

  context.refreshStep = function(_) {
    if (!arguments.length) return refreshStep;
    refreshStep = +_;
    return update();
  };
 
  // Set or get the context size (the count of metric values).
  // Defaults to 1440 (four hours at ten seconds).
  context.size = function(_) {
    if (!arguments.length) return size;
    scale.range([0, size = +_]);
    return update();
  };

  // The server delay is the amount of time we wait for the server to compute a
  // metric. This delay may result from clock skew or from delays collecting
  // metrics from various hosts. Defaults to 4 seconds.
  context.serverDelay = function(_) {
    if (!arguments.length) return serverDelay;
    serverDelay = +_;
    return update();
  };

  // The client delay is the amount of additional time we wait to fetch those
  // metrics from the server. The client and server delay combined represent the
  // age of the most recent displayed metric. Defaults to 1 second.
  context.clientDelay = function(_) {
    if (!arguments.length) return clientDelay;
    clientDelay = +_;
    return update();
  };

  // Sets the focus to the specified index, and dispatches a "focus" event.
  context.focus = function(i) {
    event.focus.call(context, focus = i);
    return context;
  };

  // Add, remove or get listeners for events.
  context.on = function(type, listener) {
    if (arguments.length < 2) return event.on(type);

    event.on(type, listener);

    // Notify the listener of the current start and stop time, as appropriate.
    // This way, metrics can make requests for data immediately,
    // and likewise the axis can display itself synchronously.
    if (listener != null) {
      if (/^prepare(\.|$)/.test(type)) listener.call(context, start1, stop1);
      if (/^beforechange(\.|$)/.test(type)) listener.call(context, start0, stop0);
      if (/^change(\.|$)/.test(type)) listener.call(context, start0, stop0);
      if (/^focus(\.|$)/.test(type)) listener.call(context, focus);
    }

    return context;
  };

  d3.select(window).on("keydown.context-" + ++cubism_id, function() {
    switch (!d3.event.metaKey && d3.event.keyCode) {
      case 37: // left
        if (focus == null) focus = size - 1;
        if (focus > 0) context.focus(--focus);
        break;
      case 39: // right
        if (focus == null) focus = size - 2;
        if (focus < size - 1) context.focus(++focus);
        break;
      default: return;
    }
    d3.event.preventDefault();
  });

  return update();
};

function cubism_context() {}

var cubism_contextPrototype = cubism.context.prototype = cubism_context.prototype;

cubism_contextPrototype.constant = function(value) {
  return new cubism_metricConstant(this, +value);
};
