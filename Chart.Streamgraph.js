(function(){
	"use strict";

  function throwError(msg){
    throw Error('Chart.Streamgraph: '+msg);
  }

  function allDatasetsSameLength(datasets){
    if (!datasets.length){ throwError('dataset must be an array'); }
    if (!datasets[0].data || !datasets[0].data.length){ throwError('dataset must have array value data'); }

    var firstLength = datasets[0].data.length;

    for (var i = 1; i < datasets.length; i++){
      if (!datasets[i].data || !datasets[i].data.length){ throwError('dataset must have array value data'); }
      if (firstLength !== datasets[i].data.length){ return false; }
    }

    return true;
  }

  function makeLayer(dataset, index){
    var layer = {};
    helpers.extend(layer, dataset);
    layer.data = [];

    helpers.each(dataset.data, function(datum){
      layer.data.push({
        x: index, 
        width: datum,
      });
    });

    return layer;
  }

  function generateLayers(datasets){
    var layers = [];
    helpers.each(datasets, function(dataset, index){
      layers.push(makeLayer(dataset, index));
    });
    return layers;
  }

  function generateLayerStats(layers){
    helpers.each(layers, function(layer){
      var onsetFound = false;
      var curWidth = 0;

      layer.onset = 0;
      layer.sum = 0;
      layer.maxWidth = 0;
      layer.maxWidthIndex = 0;
      layer.secondWidthIndex = 0;

      for (var i = 0; i < layer.data.length; i++){
        curWidth = layer.data[i].width;
        if (!onsetFound){ layer.onset = i; }
        if (curWidth  > 0){ 
          onsetFound = true;
        }
        layer.sum += curWidth;
        if(curWidth >= layer.maxWidth){
          layer.maxWidth = curWidth;
          layer.secondWidthIndex = layer.maxWidthIndex;
          layer.maxWidthIndex = i;
        }
      }
    });
  }

  function reorderLayersOutward(layers){
    var topLayers = [];
    var bottomLayers = [];
    var topSum = 0, bottomSum = 0;

    helpers.each(layers, function(layer){
      if (topSum < bottomSum){
        topLayers.push(layer);
        topSum += 1;//layer.sum;
      } else {
        bottomLayers.push(layer);
        bottomSum += 1;//layer.sum;
      }
    });
    return bottomLayers.concat(topLayers);
  }

  function generateBaseline(layers){
    // based on MinimizedWiggle Layout from original paper
    var n = layers[0].data.length; 
    var m = layers.length;
    var baseline = [];

    for(var i = 0; i < n; i++){
      var currentValue = 0;
      for(var j = 0; j < m; j++){
        currentValue += (m - j -0.5) * layers[j].data[i].width;
      }
      currentValue /= m;
      baseline.push(currentValue);
    }
    return baseline;
  }

  function applyBaseline(layers, baseline){
    var currentBaseline = baseline.slice();

    helpers.each(layers, function(layer){
      helpers.each(layer.data, function(datum, i){
        datum.y1 = currentBaseline[i];
        datum.y0 = datum.y1-datum.width;
        currentBaseline[i] = datum.y0;
      });
    });
  }

  function findMaxAndMin(layers){
    var min = Infinity;
    var max = -Infinity;
    for(var i = 0; i < layers.length; i++){
      for(var j = 0; j < layers[i].data.length; j++){
        if (layers[i].data[j].y0 > max){ max = layers[i].data[j].y0; } 
        if (layers[i].data[j].y1 < min){ min = layers[i].data[j].y1; } 
      }
    }
    return {min: min, max: max};
  }
  
  // ---- drawing

  function getDrawPoints(data, scale){
    var points = [];
    for (var i = 0; i < data.length; i++){
      points.push({
        top: { x: scale.calculateX(i), y: scale.calculateY(data[i].y0)},
        bottom: { x: scale.calculateX(i), y: scale.calculateY(data[i].y1)+1},
      });
    }
    return points;
  }

  function decorateBeziers(points, key, scaler){
    // http://processingjs.nihongoresources.com/code%20repository/?get=Catmull-Rom-to-Bezier
    for (var i = 0; i < points.length; i++){
      var p1 = points[i-2 >= 0 ? i-2 : 0][key];
      var p2 = points[i-1 >= 0 ? i-1 : 0][key];
      var current = points[i][key];
      var next = points[i+1 < points.length ? i+1 : points.length - 1][key];

      var dx1 = (current.x - p1.x)/scaler;
      var dy1 = (current.y - p1.y)/scaler;

      var dx2 = (next.x - p2.x)/scaler;
      var dy2 = (next.y - p2.y)/scaler;

      current.ctlPoints = {
        p1: { x: p2.x+dx1, y: p2.y+dy1 },
        p2: { x: current.x-dx2, y: current.y-dy2 }
      };
    }

    return points; 
  }


  function addControlPoints(points, tension){
    if (!tension){ tension = 0.5; }
    if (tension <= 0){ tension = 0.00001; }
    if (tension > 1){ tension = 1; }

    var scaler = -6/(tension-1);

    decorateBeziers(points, 'top', scaler);
    points.reverse();
    decorateBeziers(points, 'bottom', scaler);
    points.reverse();
    return points;
  }

  function drawLayer(layer, ctx, scale, options){

    var points = layer.points = getDrawPoints(layer.data, scale);
    var drawOnset, current;

    var i;

    drawOnset = layer.onset > 0 ? layer.onset - 1 : 0;
    current = points[drawOnset].top;

    ctx.beginPath();
    ctx.moveTo(current.x, current.y);

    // draw curved streamgraph layer
    if(options.curve){

      // add control points to drawing points
      addControlPoints(points, options.curveTension);

      for (i = drawOnset + 1; i < points.length; i++){
        current = points[i].top;
        ctx.bezierCurveTo(
            current.ctlPoints.p1.x,
            current.ctlPoints.p1.y,
            current.ctlPoints.p2.x,
            current.ctlPoints.p2.y,
            current.x,
            current.y
        ); 
      }

      current = points[points.length - 1].bottom;
      ctx.lineTo(current.x, current.y);

      for (i = points.length - 2; i >=drawOnset; i--){
        current = points[i].bottom;
        ctx.bezierCurveTo(
            current.ctlPoints.p1.x,
            current.ctlPoints.p1.y,
            current.ctlPoints.p2.x,
            current.ctlPoints.p2.y,
            current.x,
            current.y
        ); 
      }

    // straight line streamgraph
    } else {

      for(i = drawOnset+1; i < points.length; i++){
        current = points[i].top;
        ctx.lineTo(current.x, current.y);
      }
      for(i = points.length - 1; i >= drawOnset; i--){
        current = points[i].bottom;
        ctx.lineTo(current.x, current.y);
      }
    }

    if (layer.hover && options.colorHighlight){ 
      ctx.fillStyle = layer.hoverColor; 
    } else { 
      ctx.fillStyle = layer.color; 
    }

    if (options.stroke){
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.strokeWidth;
      ctx.stroke();
    }
    ctx.fill();

  }

  function drawLabel(layer, ctx, scale, options){
    var labelLoc;

    if (options.labelPlacementMethod === "maxHeight"){
      labelLoc = getHeightLabelPlacement(layer, ctx, scale, options);
    } else {
      labelLoc = getIdealLabelPlacement(layer, ctx, scale, options);
    }

    if(labelLoc.point){
      ctx.font = helpers.fontString(labelLoc.size, options.labelFontStyle, options.labelFontFamily); 
      ctx.textAlign = options.labelPlacementMethod === 'maxHeight' ? 'center' : 'left';
      ctx.textBaseline = options.labelPlacementMethod === 'maxHeight' ? 'middle' : 'hanging';

      ctx.fillStyle = layer.textColor || options.labelFontColor;
      ctx.fillText(layer.label, labelLoc.point.x, labelLoc.point.y);
    }
  }

  function getIdealLabelPlacement(layer, ctx, scale, options){

    var point, currentHeight, derivedHeight;
    var topBound, bottomBound, outOfBounds;
    var margin;
    var reqWidth, derivedWidth;
    var consideredFontSize, selectedFontSize=0;
    var consideredLocation, selectedLocation; 
    var points = layer.points;

    var graphWidth = ctx.canvas.width;

    for(var i = 0; i < points.length; i++){
      point = points[i];
      currentHeight = point.bottom.y - point.top.y;
      derivedHeight = currentHeight*0.5;

      if (derivedHeight >= options.labelMinimumSize && derivedHeight >= selectedFontSize && point.top.x >= 0){

        margin = currentHeight*0.25;
        topBound = point.top.y + margin;
        bottomBound = point.bottom.y - margin;
        outOfBounds = false;

        consideredLocation = { x: point.top.x, y: topBound };


        consideredFontSize = derivedHeight;

        ctx.textBaseline = "top"; 
        ctx.font = helpers.fontString(derivedHeight, options.labelFontStyle, options.labelFontFamily); 

        reqWidth = ctx.measureText(layer.label).width;

        derivedWidth = 0;
        
        var j = i+1;
        while (derivedWidth < reqWidth && !outOfBounds && j < points.length && point.top.x < graphWidth){

          point = points[j];
          if (point.bottom.y < bottomBound || point.top.y > topBound){
            outOfBounds = true;
          }

          derivedWidth += scale.valueWidth;
          j++;  
        }

        if (derivedWidth > reqWidth && !outOfBounds){
          selectedLocation = consideredLocation;
          selectedFontSize = consideredFontSize;
        }
      }
    }
    if (!selectedLocation && options.labelPlacementMethod === 'idealThenMaxHeight'){
      return getHeightLabelPlacement(layer, ctx, scale, options);
    }
    return {point:selectedLocation, size: options.labelFixedSize || selectedFontSize };
  }

  function getHeightLabelPlacement(layer, ctx, scale, options){

    var i = layer.maxWidthIndex;
    var x = scale.calculateX(i);
    var datum = layer.data[i];

    var y = scale.calculateY(
        datum.y0+datum.width*0.5
    );

    var size;

    if (options.labelFixedSize){
      x = adjustXToFit(x, options.labelFixedSize, ctx, layer, options);
      return {point:{x:x, y:y}, size: options.labelFixedSize};
    } else {
      size = (scale.calculateY(1) - scale.calculateY(0))*datum.width*0.4;
      if (size >= options.labelMinimumSize){
        x = adjustXToFit(x, options.labelFixedSize, ctx, layer, options);
        return {point:{x:x, y:y}, size: size};
      } else {
        return {};
      }
    }
    
  }

  function adjustXToFit(x, size, ctx, layer, options){
    var textWidth,
        graphWidth = ctx.canvas.width - 10; // minus 10 for margins

    ctx.font = helpers.fontString(size, options.labelFontStyle, options.labelFontFamily); 
    textWidth = ctx.measureText(layer.label).width;
    
    while (x+textWidth > graphWidth){
      x -= textWidth;
    }

    return x;
  }

  function drawLayers(layers, ctx, scale, options){
    helpers.each(layers, function(layer){
      drawLayer(layer, ctx, scale, options);
    });
    
    if (options.labels){
      // we draw labels on top of the entire graph
      helpers.each(layers, function(layer){
        drawLabel(layer, ctx, scale, options);
      });
    }
  }

  // color functions

  function rgbString(r,g,b,a){
    r = clamped(r, 0, 255);
    g = clamped(g, 0, 255);
    b = clamped(b, 0, 255);
    a = clamped(a, 0, 255);
    return 'rgba('+Math.floor(r)+','+Math.floor(g)+','+Math.floor(b)+','+a+')';
  }

  function clamped(n, min, max){
    return Math.max(min, Math.min(n, max));
  }
  
  function interp(v1,v2,x){
    return v2*x+v1*(1-x);
  }

  function getLayersInColorOrder(layers, options){
    var colorMethod = options.colorAssignmentMethod;
    var layerCopy = layers.concat();

    if (colorMethod === 'maxHeight'){
      return layerCopy.sort(function(a,b){ return b.maxWidth - a.maxWidth; }); // reverse to make intuitive
    } else if (colorMethod === 'sum'){
      return layerCopy.sort(function(a,b){ return b.sum - a.sum; });
    } else {
      return layerCopy;
    }
  }

  function getGradientColor(colors, i, scaleFactor){
    var fIndex = i*scaleFactor;
    var iIndex = Math.floor(fIndex);
    var iv = fIndex - iIndex;
    var iIndex1 = iIndex+1;
    if (iIndex1 > colors.length- 1){ iIndex1 = iIndex; }
    
    return {
      r:  interp(colors[iIndex][0], colors[iIndex1][0], iv),
      g:  interp(colors[iIndex][1], colors[iIndex1][1], iv),
      b:  interp(colors[iIndex][2], colors[iIndex1][2], iv),
      a:  interp(colors[iIndex][3], colors[iIndex1][3], iv)
    };
  }

  function getIndexedColor(colors, i, scaleFactor){
    var index = Math.floor(i*scaleFactor);
    return {
      r: colors[index][0],
      g: colors[index][1],
      b: colors[index][2],
      a: colors[index][3],
    };
  }

  function getCycledColor(colors, i){
    var index = i%colors.length;
    return {
      r: colors[index][0],
      g: colors[index][1],
      b: colors[index][2],
      a: colors[index][3],
    };
  }

  function getScaledColor(val, scale){
    val *= scale;
    return val > 255 ? 255 : val;
  }

  function getHighlightColor(color, options){
    return {
      r: getScaledColor(color.r, options.colorHighlightMultiplier),
      g: getScaledColor(color.g, options.colorHighlightMultiplier),
      b: getScaledColor(color.b, options.colorHighlightMultiplier),
      a: color.a
    };
  }

  function cssColorToObject(color){
    var clr = cssColorParser(color);
    return {
      r: clr[0],
      g: clr[1],
      b: clr[2],
      a: clr[3]
    };
  }

  function applyColors(colors, layers, options){
    var results = [];
    var scaleFactor;
    var colorFunction;

    if (options.colorInterpolation === 'gradient'){
      colorFunction = getGradientColor;
      scaleFactor = (colors.length-1)/(layers.length-1);
    } else if (options.colorInterpolation === 'cycle'){
      colorFunction = getCycledColor;
    } else {
      colorFunction = getIndexedColor;
      scaleFactor = colors.length/layers.length;
    }

    // this function returns a copy of the layers
    var orderedLayers = getLayersInColorOrder(layers, options);
    var clr, hclr;

    for (var i = 0; i < orderedLayers.length; i++){
      if (orderedLayers[i].fillColor){
        if (orderedLayers[i].highlightColor){
          orderedLayers[i].color = orderedLayers[i].fillColor;
          orderedLayers[i].hoverColor = orderedLayers[i].highlightColor;
        } else {
          clr = cssColorToObject(orderedLayers[i].fillColor);
          hclr = getHighlightColor(clr, options);
          orderedLayers[i].color = rgbString(clr.r, clr.g, clr.b, clr.a);
          orderedLayers[i].hoverColor = rgbString(hclr.r, hclr.g, hclr.b, hclr.a);
        }
      } else {
        clr = colorFunction(colors, i, scaleFactor);
        hclr = getHighlightColor(clr, options);
        orderedLayers[i].color = rgbString(clr.r, clr.g, clr.b, clr.a);
        orderedLayers[i].hoverColor = rgbString(hclr.r, hclr.g, hclr.b, hclr.a);
      }

    }

    return layers;
  }

  function findBoxIndex(x, offset, scaling){
    return Math.floor((x - offset)/scaling);
  }

  function pointWithinPoly(x,y, points){
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
        var xi = points[i].x, yi = points[i].y;
        var xj = points[j].x, yj = points[j].y;
        
        var intersect = ((yi > y) !== (yj > y)) && 
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointWithinLayer(x, y, ind, layer){
    if (ind < layer.onset){ return false; }
    if (ind > 0){ ind = ind - 1;}
    var top = ind + 2;
    if (top > layer.points.length - 1) { top = layer.point.length - 1; }
    
    var points = layer.points;
    var testPoints = [
      points[ind].top, points[ind].bottom, points[top].bottom, points[top].top
    ];
    return pointWithinPoly(x, y, testPoints);
  }
  // rounding function
  function roundedTwoDigits( number){
    return Math.round(number*100)/100; 
  }

  // Chart.js module definition

  var helpers = Chart.helpers;

	var defaultConfig = {
    // string - background color for graph
    backgroundColor: '#fff',

    // boolean - whether the data sets are outlined.
    stroke: true,

    // Number - width of the outline stroke.
    strokeWidth: 2,

    // String - the outline stroke color.
    strokeColor: "rgb(255,255,255)",

    // Boolean - whether grid lines are shown across the chart.
    scaleShowGridLines: true,

    // String - color of the grid lines.
    scaleGridLineColor: "rgba(0,0,0,0.1)",

    // Number - width of the grid lines.
    scaleGridLineWidth: 1,

    // Boolean - whether to show horizontal lines (except X axis).
    scaleShowHorizontalLines: true,

    // Boolean - whether to show vertical lines (except Y axis).
    scaleShowVerticalLines: true,
    
    // Number - number of scale divisions
    scaleDivisions: 6,

    // Boolean - whether the line is curved between points.
    curve: true,

    // Number - tension of the curve between points.
    curveTension: 0.1,

    // String - "gradient", "palette", "cycle" which determinines
    // the way colors are generated. Ignored if colors are specified within
    // the datasets. See below.
    colorInterpolation: "gradient",

    // Array[String] - the colors used for the active color scheme.
    // Any number of colors is allowed.
    colors: [ "rgba(220,220,220,0.9)", "rgba(151,187,205,0.9)"],
    // Boolean - whether streams change color on hover.
    colorHighlight: true, 

    // Number - a floating point value which specifies how much lighter or
    // darker a color becomes when hovered, where 1 is no change, 
    // 0.9 is slightly darker, and 1.1 is slightly lighter.
    colorHighlightMultiplier: 0.92,

    // String - "verticalPosition", "sum", "maxHeight"
    // The method in which colors are assigned to 
    // each dataset. See below.
    colorAssignmentMethod: "verticalPosition",

    // Boolean - Whether to draw labels
    labels: true, 

    // Boolean or Number - Whether label has a fixed size,
    // and if so, what point size is it. False if labels
    // are adaptable size.
    labelFixedSize: false,

    // Number - the minimum size of the label. When variable label 
    // sizes are enabled using the labelFixedSize: all 
    // labels smaller than this size are not renderend. A value of 
    // 0 turns this feature off.
    labelMinimumSize: 12,

    // String - label font family
    //labelFontFamily: "'HelveticaNeue-Light', 'Helvetica Neue Light', 'Helvetica', 'Arial', sans-serif",
    labelFontFamily: '"HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif',
    // String - label font style
    labelFontStyle: "normal",

    // String - label font color. Can be overwritten manually in dataset.
    labelFontColor: "rgba(64,64,64,0.5)",

    // String - "ideal","idealThenMaxHeight", "maxHeight". 
    // Label placement method. Can be overwitten manually in 
    // dataset. See below.
    labelPlacementMethod: "ideal",

    // String - template for multitooltip
    multiTooltipTemplate: "x:<%= xLabel %> y:<%= value %>"
	};


	Chart.Type.extend({
		name: "Streamgraph",

		defaults : defaultConfig,

		initialize:  function(data){
      this.layerColors = this.options.colors.map(function(cssColor){
        return cssColorParser(cssColor);
      });
      if (!allDatasetsSameLength(data.datasets)){ throwError('all datasets must be same length'); }

      this.layers = generateLayers(data.datasets);
      generateLayerStats(this.layers);
      this.layers = reorderLayersOutward(this.layers);
      this.baseline = generateBaseline(this.layers);
      applyBaseline(this.layers, this.baseline);
      applyColors(this.layerColors, this.layers, this.options);
      this.hover = -1;
      this.hoverIndex = -1;

      
      // layer highlight & tooltip functionality
      if (this.options.showTooltips && this.options.colorHighlight){
        helpers.bindEvents(this, this.options.tooltipEvents, function(e){
          // here we decorate layer with highlight information

          var selectedFound = false;
          var m = helpers.getRelativePosition(e);
          var hoverStatus = -1;
          var hoverIndex = -1;
          var innerWidth = this.scale.width - (this.scale.xScalePaddingLeft + this.scale.xScalePaddingRight);
          var valueWidth = innerWidth/Math.max((this.scale.valuesCount - ((this.scale.offsetGridLines) ? 0 : 1)), 1);

          var ind = findBoxIndex(m.x+1, this.scale.xScalePaddingLeft, valueWidth);

          for (var i = 0; i < this.layers.length; i++){
            if ( !this.layers[i].points || selectedFound || ind > this.layers[i].points.length - 2){
              this.layers[i].hover = false;
            } else if (pointWithinLayer(m.x, m.y, ind, this.layers[i])){
              selectedFound = this.layers[i].hover = true; 
              hoverStatus = i;
              hoverIndex = ind;
            } else {
              this.layers[i].hover = false;
            }
          }

          if (this.hover !== hoverStatus || this.hoverIndex !== hoverIndex){
            this.hover = hoverStatus;
            this.hoverIndex = hoverIndex;
            this.draw();


            // this ought to be configurable, ie, do we show total?
            // or current value? if the former, we do not need to more the tooltip
            if(selectedFound && this.options.showTooltips){
              var label = helpers.template(this.options.multiTooltipTemplate, {
                x: hoverIndex,
                xLabel: data.labels[hoverIndex],
                value: roundedTwoDigits(this.layers[hoverStatus].data[hoverIndex].width),
                sum: roundedTwoDigits(this.layers[hoverStatus].sum),
                maxWidth: roundedTwoDigits(this.layers[hoverStatus].maxWidth),
                tooltipData: this.layers[hoverStatus].tooltipData
              });

              new Chart.MultiTooltip({
                x: this.scale.calculateX(ind),
                y: m.y,
                xPadding: this.options.tooltipXPadding,
                yPadding: this.options.tooltipYPadding,
                xOffset: this.options.tooltipXOffset,
                fillColor: this.options.tooltipFillColor,
                textColor: this.options.tooltipFontColor,
                fontFamily: this.options.tooltipFontFamily,
                fontStyle: this.options.tooltipFontStyle,
                fontSize: this.options.tooltipFontSize,
                titleTextColor: this.options.tooltipTitleFontColor,
                titleFontFamily: this.options.tooltipTitleFontFamily,
                titleFontStyle: this.options.tooltipTitleFontStyle,
                titleFontSize: this.options.tooltipTitleFontSize,
                cornerRadius: this.options.tooltipCornerRadius,
                //labels: ["fail"+
                labels: [label],
                legendColors: [{
                  fill: this.layers[this.hover].hoverColor, 
                  stroke: this.layers[this.hover].hoverColor,
                }],
                legendColorBackground : this.options.multiTooltipKeyBackground,
                title: this.layers[this.hover].label,
                chart: this.chart,
                ctx: this.chart.ctx,
                custom: this.options.customTooltips
              }).draw();

            }
          }

        }.bind(this));
      }

      this.buildScale(data.labels, this.options);

      this.render();

		},

    generateLegend: function(){
      console.error('Chart.Streamgraph: legend generation not supported');
    },

		update : function(){
      this.render();
		},

		buildScale : function(labels, options){
			var self = this;

			var scaleOptions = {
				templateString : '<%= Math.abs(Math.round(value*100)/100) %>',
				height : this.chart.height,
				width : this.chart.width,
				ctx : this.chart.ctx,
				textColor : this.options.scaleFontColor,
				fontSize : this.options.scaleFontSize,
				fontStyle : this.options.scaleFontStyle,
				fontFamily : this.options.scaleFontFamily,
				valuesCount : labels.length,
				beginAtZero : this.options.scaleBeginAtZero,
				integersOnly : this.options.scaleIntegersOnly,
				calculateYRange : function(){
          var minMax = findMaxAndMin(self.layers);
          var value = Math.floor(Math.max(Math.abs(minMax.min), Math.abs(minMax.max))*1.5);
          minMax = {min: value, max: -value};
          var range = minMax.max-minMax.min;
          helpers.extend(this, minMax);
          helpers.extend(this, {steps: options.scaleDivisions, stepValue: range/options.scaleDivisions});
        },
				xLabels : labels,
				font : helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
				lineWidth : this.options.scaleLineWidth,
				lineColor : this.options.scaleLineColor,
				showHorizontalLines : this.options.scaleShowHorizontalLines,
				showVerticalLines : this.options.scaleShowHorizontalLines,
				gridLineWidth : (this.options.scaleShowGridLines) ? this.options.scaleGridLineWidth : 0,
				gridLineColor : (this.options.scaleShowGridLines) ? this.options.scaleGridLineColor : "rgba(0,0,0,0)",
				padding: 2,
				showLabels : this.options.scaleShowLabels,
				display : this.options.showScale,
			};

			if (this.options.scaleOverride){
        // because chart is 'upside down'
        // flip
        
        this.options.scaleStepWidth = -Math.abs(this.options.scaleStepWidth);
        this.options.scaleStartValue = -this.options.scaleStartValue;

				helpers.extend(scaleOptions, {
					calculateYRange: helpers.noop,
					steps: this.options.scaleSteps,
					stepValue: this.options.scaleStepWidth,
					min: this.options.scaleStartValue,
					max: this.options.scaleStartValue + (this.options.scaleSteps * this.options.scaleStepWidth)
				});
			}

			this.scale = new Chart.Scale(scaleOptions);

      this.scale.innerWidth = this.scale.width - (this.scale.xScalePaddingLeft + this.scale.xScalePaddingRight);
      this.scale.valueWidth = this.scale.innerWidth/Math.max((this.scale.valuesCount - ((this.scale.offsetGridLines) ? 0 : 1)), 1);
    },

		reflow : function(){
      this.scale.update({
        width: this.chart.width,
        height: this.chart.height 
      });
		},

		draw : function(){
      var ctx = this.chart.ctx;
      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(0,0,this.chart.width, this.chart.height);
      this.scale.draw();
      drawLayers(this.layers, ctx, this.scale, this.options);
		}
	});

})();
