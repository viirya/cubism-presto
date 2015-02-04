cubism_contextPrototype.presto = function(url) {
  if (!arguments.length) url = "";
  var source = {},
      context = this;

  var timezone = 8;
 
  var aggregation_func = "sum";
  var approximation_mode = true;

  var timeField = "time",
      timeFieldIsString = false,
      timeFieldStatement = timeField,
      valueField = "value";

  var interval = 1e5;

  var pseudonow = moment().format("YYYY-MM-DD hh:mm:ss");
      now = "date_parse('" + pseudonow + "', '%Y-%m-%e %H:%i:%s')";

  source.setAggregationFunc = function(func) {
    aggregation_func = func;
    return this;
  }

  source.setApproximationMode = function(isApprox) {
    approximation_mode = isApprox;
    return this;
  }

  source.setTimeField = function(field, isString)  {
    timeField = field;
    if (isString) {
      timeFieldStatement = "date_parse(" + timeField + ", '%Y-%m-%e %H:%i:%s')";
    } else {
      timeFieldStatement = timeField;
    }
    return this;
  };

  source.setValueField = function(field) {
    valueField = field;
    return this;
  };

  source.setInterval = function(itval) {
    interval = itval;
    return this;
  } 

  source.metric = function(table, title) {

    var metric = context.metric(function(start, stop, step, callback) {
      var query = 'select ';
      query +=  '$datetrunc as time, ';
      query +=  aggregation_func + '(' + valueField + ')';
      query += ' from ' + table + ' where $timeFilter';
      query += ' group by $interval';

      var timeFilter = getTimeFilter(timeFieldStatement, timezone, start, stop);

      query = query.replace('$timeFilter', timeFilter);

      var prestoIntervalState = getPrestoInterval(timeFieldStatement, moment(start.toString()).format("YYYY-MM-DD hh:mm:ss"), step / 1000);

      query = query.replace('$interval', prestoIntervalState);
      query = query.replace('$datetrunc', prestoIntervalState);
      query += " order by " + prestoIntervalState + " asc";

      if (approximation_mode) {
        query += ' APPROXIMATE AT 95.0 CONFIDENCE';
      }

      console.log("query: " + query);

      query += ";&db=presto";

      d3.json(url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .post("query=" + query, function(error, json) {
          if (!json) return callback(new Error("unable to load data"));
          callback(null, cubism_prestoParse(json, approximation_mode, step / 1000, start.toString()));
        });
    }, title += "");

    return metric;
  };

  return source;
};

function parseApproximateData(data, valueCol) {
  data.forEach(function(point) {
    if (point[valueCol]) {
      var res = point[valueCol].match(/(.*)\+\/-/);
      if (res) {
        if (res[1].match(/\./)) {  
          point[valueCol] = parseFloat(res[1]);  
        } else {
          point[valueCol] = parseInt(res[1]);
        }
      } else {
        point[valueCol] = 0;
      }
    } else {
      point[valueCol] = 0;
    }
  });
  return data;
}

function cubism_prestoParse(json, approximation_mode, step, sinceDate) {

  var timeCol = 0, valueCol = 1;

  if (approximation_mode) {
    json.Data = parseApproximateData(json.Data, valueCol);
  }

  var sinceDateSeconds = moment(sinceDate).unix();

  var data = [];
  json.Data.forEach(function (element, index) {
    var timeValue = element[timeCol] * step + sinceDateSeconds;
    data[index] = element[valueCol];
  });
  return data;
}

function getTimeFilter(timeFieldStatement, timeZone, from, until) {
  
  parsedFrom = moment(from).unix();
  parsedUntil = moment(until).unix();
  
  parsedFrom += timeZone * 60 * 60;
  parsedUntil += timeZone * 60 * 60;
  
  return "to_unixtime(" + timeFieldStatement + ") > " + parsedFrom +
    " and to_unixtime(" + timeFieldStatement + ") < " + parsedUntil;
}

function getPrestoInterval(timeFieldStatement, sinceDate, intervalSeconds) {
  
  return "floor((to_unixtime(" + timeFieldStatement +
         ") - to_unixtime(date_parse('" + sinceDate +
         "', '%Y-%m-%e %H:%i:%s'))) / (" + intervalSeconds + "))";
}
