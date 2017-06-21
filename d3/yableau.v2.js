/*
Yableau Usage:

Methods: bar, column, area, curve, pie, sankey, map.

1) bar/column/area/curve:
yableau[type] = function(divId, origData, xField, yFields, param, title){
Inputs: 
	divId (string): the div id of html page.
	origData (array of objects): original data, format: [{field1: value1a, field2: value2a, ...}, {field1: value1b, field2: value2b, ...}, ...]
	xField (string): the name of X field.
	yFields (string | array of strings | {values:string, legend:string}): the names of Y field(s).
	                If it is a string, it means only one Y value per xField.
	                If it's an array, it means there are several Y values per xFields, stacked or listed.
	                If it's a {}, refer Excel Pivot definition. See comments of funciton handleValuesAndLegend().
	param (object): describes parameters for the chart. They are:
		param.filters ([null] | empty {}): to store filters between associated charts.Set it to null if you don't need it.
		    param.filters.single([false] | true): if true, only single selection allowed, otherwise multiple.
		    param.filters.redraw: function(divId, param). for post actions.
		param.map (string): map / GeoJson file name.
		param.listed ([false] | true): if true, listed; if false, stacked.
		param.yUnits ([]): units for display. e.g. ["%"].
		param.yDomain (array(2)): the value domain for fixed value height between multi charts.
		param.sortType (string): null | "ya" | "yd" | "xa" | "xd"
		param.padding.
		param.linearColor ([false] | true)
		param.mouseoverColor[].
		param.mouseoutColor[].
		param.hideTooltip ([false] | true)
		param.hideLegend ([false] | true)
		param.hideYaxis: ([false] | true)
		param.barNbr: the max bar number in given height of a bar chart, if not enough, enlarge the height.
		param.xTickNbr: the tick number of X axis.
		param.yTickNbr: the tick number of Y axis.
		param.yDispValAs: "% of grand" | "% of row" | "% of column"
	title (string): title of the chart.
	
2) map
3) pie
4) area / curve
	param (object):
		param.xTick = {units: "years"|"months"|"days"|"hours"|"minutes", number: 1|2|..., format: "%Y-%m-%d %H:%M:%S"|"%y-%m"|...}
		
5) sankey
6) force
7) bubble (pack)
8) table

*/

yableau = function() {
	
var yableau = {version: "2.0.0"};
var PI = 3.1416;
var duration = 300;

/* number formatting
		format specifier	resulting formatted number
		d3.format("")	0
		d3.format("s")	0
		d3.format(",%")	0%
		d3.format("+,%")	+0%
		d3.format(",.1%")	0.0%
		d3.format(".4r")	0.000
		d3.format(".4f")	0.0000
		d3.format(".4n")	0.000
		d3.format(".3n")	0.00
		d3.format(",d")	0
		d3.format(",.0f")	0
		d3.format(".0f")	0
		d3.format(".0e")	0e+0
		d3.format(".1e")	0.0e+0
*/
var formatNumber = d3.format(",.2f");    // 99.99 as default.
var format = function(param, d, key) {
	var str = d; 
	if (param.format) {
		str = param.format(d);
	}else{
		str += ""; 
		if (str.match(/\.\d\d\d/)){
			str = formatNumber(d);
		}
	}
	if (key && param[key]) str += " " + param[key];
	return str;
}

//-----------------------------------------------------------------------------------------------	

function clone(obj) {
    var copy;
    //  handle null & undefined
    if (null == obj || "object" != typeof obj) return obj;
    // handle date type
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }
    // handle array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // handle object
    if (obj instanceof Object) {
        copy = {};
        for (var param in obj) {
            if (obj.hasOwnProperty(param)) copy[param] = clone(obj[param]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

//-------------------------------------------------------------------------------
//-------------------------------------------------------------------------------
// convert y.values & y.legend to yFields.
/*  +---------------------------+----------------------------+
    |           N.A.            +         Legend             |
	+---------------------------+----------------------------+
    |         xField (Axis)     +      value0, value1, ...   |
	+---------------------------+----------------------------+
    
	when Legend = L0, L1, ..., 
    yField = ["value0 - L0", 
	          "value0 - L1", 
			  "value0 - ...", 
			  "value1 - L0", 
			  "value1 - L1", 
			  "value1 - ..."] 
*/
function handleValuesAndLegend(origData, y, param) {
	
	// init and store origData, maybe there are several origData;
	if(!yableau.globalInit) yableau.globalInit = []; 
	var found = false;
	yableau.globalInit.forEach(function(d){
		if (d == origData) found = true;
	})
	if(!found){
		yableau.globalInit.push(origData);
		// fill all empty field with '(blank)'.
		d3.keys(origData[0]).forEach(function(f){
			origData.forEach(function(d){
				if (d[f] == "") d[f] = "(blank)";
			})
		})
	}
	
	var initRc = {yFields: [], legend: "", leKeys: [null]};
	
	if (!y) {
		return {yFields: [""]};
	}
	else if (typeof (y) == 'string') {
		initRc.yFields = [y];
	}
	else if (y instanceof Array) {
		initRc.yFields = y;
	}
	else if (!y.values) {
		return {yFields: [""]};
	}
	else {
		if (typeof (y.values) == 'string') {
			initRc.yFields = [y.values];
		}else{
		    initRc.yFields = y.values;
		}
        if (y.legend) {
            var le = {};
            origData.forEach(function(d){
                le[d[y.legend]] = 1;
            });
            initRc.leKeys = d3.keys(le).sort();
            initRc.legend = y.legend;
        }
    }
	var genYx = function(t, v, l){
	    // test for simple display. 20170606. i.s.o. "sum of counter - ..."
		var rs = ""; // t + " of " + v;
		if (l) rs += l;
		return rs;
	}
	if(!param.yType) param.yType = "sum";
	origData.forEach(function(d){
		initRc.yFields.forEach(function(v){
			initRc.leKeys.forEach(function(l){
				var yx = genYx (param.yType, v, l);
				if (l === null || l == d[initRc.legend]) {
					d[yx] = d[v];
				}else{
					d[yx] = "";
				}
			})
		})
	})
	
	var new_y = [];
	initRc.yFields.forEach(function(v){
		initRc.leKeys.forEach(function(l){
			var yx = genYx (param.yType, v, l);
			new_y.push(yx);
		})
	})
	
	return {yFields: new_y, legend: y.legend, leKeys: le};
}


//-------------------------------------------------------------------------------
// A dedicated stack data hander for both positive and negative values.
// Rules: 1. y0 only accumulate same side, pos or neg.
//        2. if a y-value is positive, y0 is previous values added.
//           if a y-value is negative, y0 is previous values added plus this one.
//        3. height is abs(h)
// return: [max, min]
function biStack(d, listed) {
	var max=0, min=0;
	for (var i=0; i<d.length; i++){
		for (var k=0; k<d[i].length; k++) {
			var iMax=0, iMin = 0;
			if (d[i][k].y >= 0){
				var y0 = 0;
				for (var n=0; n<i; n++){
					if (d[n][k].y >= 0) {
						y0 += listed ? 0 : d[n][k].y;
					}
				}
				d[i][k].y0 = y0;
				iMax = d[i][k].y + y0;
			}else{
				var y0 = d[i][k].y;
				for (var n=0; n<i; n++){
					if (d[n][k].y < 0) {
						y0 += listed ? 0 : d[n][k].y;
					}
				}
				d[i][k].y0 = y0;
				iMin = y0;
			}
			if (max < iMax) max = iMax;
			if (min > iMin) min = iMin;
		}
	}
	if (max < 0) max = 0;
	if (min > 0) min = 0;
	return [min, max];
}

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
function buildDataSets(divId, origData, xField, yFields, param){
	if (!xField) return []; // for table.
	
	var datasets = [];
	
	if (xField instanceof Array){
		if (xField.length != 2) {
			alert ("xField must be Array(2)!");
		}else{
			var x = xField[0] + " -> " + xField[1];
			origData.forEach(function(d){
				d[x] = d[xField[0]] + " -> " +d[xField[1]];
			})
			xField = x;
		}
	}
	
	yFields.forEach(function(yField, i){
		datasets.push(buildData(divId, origData, xField, yField, i, param));
	});
	
	// data validation check
	for (var i=0; i<datasets.length-1; i++){
		if(datasets[i].length != datasets[i+1].length) {
			alert ("data error 1: ", datasets[i].length, datasets[i+1].length);
		}
		for (var k=0; k<datasets[i].length; k++){
			if (datasets[i][k].x != datasets[i+1][k].x) {
				alert ("data error 2: ", datasets[i][k].x, datasets[k+1][k].x);
			}
		}
	}

	// handling "display as" feature
	handleDispValAs(divId, datasets, param);
	
	// sort data
	if (param.sortType){
		// 冒泡法排序
		for (var i=0; i<datasets[0].length-1; i++){
			for (var k=i+1; k<datasets[0].length; k++){
				// sort for total-Y
				if (param.sortType == "ya" || param.sortType == "a" || param.sortType == "yd" || param.sortType == "d") {
					var sum_i = 0;
					var sum_k = 0;
					for (var n=0; n<datasets.length; n++){
						sum_i += datasets[n][i].y;
						sum_k += datasets[n][k].y;
					}
					if (((param.sortType == "ya" || param.sortType == "a") && sum_i > sum_k) ||
						((param.sortType == "yd" || param.sortType == "d") && sum_i < sum_k) ) {
						// exchange all datasets
						for (var n=0; n<datasets.length; n++){
							var tmpObj = datasets[n][i];
							datasets[n][i] = datasets[n][k];
							datasets[n][k] = tmpObj;
						}
					}
				}else if (param.sortType == "xa" || param.sortType == "xd"){
					if ((param.sortType == "xa" && datasets[0][i].x > datasets[0][k].x) ||
						(param.sortType == "xd" && datasets[0][i].x < datasets[0][k].x) ) {
						// exchange all datasets
						for (var n=0; n<datasets.length; n++){
							var tmpObj = datasets[n][i];
							datasets[n][i] = datasets[n][k];
							datasets[n][k] = tmpObj;
						}
					}
				}
			}
		}
	}
	
	return datasets;

	//______________________________________
	//	
	function buildData(divId, origData, xField, yField, yIdx, param){
		var noData = true;
		var dataset=[];
		/* 
		   param.filters = [{divId: ?, xField: ? value: ?}, {}, {}] 
		*/
		var fIdx = getFilterById(divId, param.filters);
		//if (fIdx == -2) fIdx = param.filters.f.length; // if filters enabled but no own filter found, use all filters.
		// *** change on 2016-09-25: learning from Tableau, the filters are not sequencial. Each filter will impact others, no matter the other charts have been filtered or not.
		/*
			x, total
			a, 1
			a, 2
			a, 3
			b, 4
			b, 6
		==>
			[{x:a, y:6, c:3}, {x:b, y:10, c:2}]
		*/
		for (var i=0; i<origData.length; i++){

			var match = true;
			for (var f=0; param.filters && f<param.filters.f.length; f++) {
				if (f == fIdx) continue; // do not filter myself!
				if ( !param.filters.f[f].values [   origData[i][param.filters.f[f].xField]   ] ) {
					match = false;
					break;
				}
			}
			if (match == false) continue; 

			// accumulate key->val pair.
			var key =  origData[i][xField];
			var val = 0;
			var cnt = 0;
			if (origData[i][yField]){
				if (isNaN(origData[i][yField])){  // is NOT a number
					if (origData[i][yField].match(/\S/)) {  // not empty
						cnt = 1;
					}
				}else{
					val = +origData[i][yField];
					cnt = 1;
				}
			}
			
			if (key == undefined) continue;
			
			var found = 0;
			for (var k=0; k<dataset.length; k++) {
				if (dataset[k].x == key) {
					dataset[k].y += val;
					dataset[k].c += cnt;
					found = 1;
					break;
				}
			}
			if (found == 0){ // a new data row.
				dataset.push({x:key, y:val, c: cnt})
			}
		}

		dataset.forEach(function(d,i){
			if (param.yType == "count") {
				d.y = d.c;
				d.c = 1;
			}else if (param.yType == "average" ) {
				if (d.c == 0) { // to avoid infinite
					d.y = 0;
					d.c = 1;
				}else{
					d.y = d.y/d.c;
				}
			}
			//delete d.c;  // jianweny 20170327 keep for further average.
			
			d._y = d.y;
			
			if (d.y) noData = false;
			if (param.shows[divId][yIdx].on == 0) d.y = 0;
		});
		
		
		param.shows[divId][yIdx].data = noData ? 0 : 1;
		
		// put counters on top. /* for DRA project */
		//d3.select(divId + "_nbr").text(dataset.length);
		
		return dataset;
	} // function buildData

	//______________________________________
	//
	function handleDispValAs(divId, datasets, param) {
		if (param.yDispValAs) {
			param.yUnit = param.yDispValAs;
		}
		
		switch (param.yDispValAs){
			case "% of grand": 
				var grand_total = 0;
				datasets.forEach(function(cols, i){
					cols.forEach(function(d){
						grand_total += d.y;
					})
				})
				datasets.forEach(function(cols){
					cols.forEach(function(d){
						d.y = grand_total ? d.y/grand_total*100 : 0;
					})
				})
				break;
				
			case "% of row": 
				datasets.forEach(function(cols, i){
					var col_total = 0;
					cols.forEach(function(d){
						col_total += d.y;
					})
					cols.forEach(function(d){
						d.y = col_total ? d.y/col_total*100 : 0;
					})
				})
				break;
				
			case "% of column": 
				datasets[0].forEach(function(_, i){
					var row_total = 0;
					datasets.forEach(function(d, s){
						row_total += d[i].y;
					})
					datasets.forEach(function(d){
						d[i].y = row_total ? d[i].y/row_total*100 : 0;
					})
				})
				break;
		}
	} // function handleDispValAs
	
}// function buildDataSets

//------------------------------------------------------------------------------------------
//
// A method to get attributes. If not found, using default values.
// return: object. {width: width-value, height: height-value, ...}
var getSetAttr = function(divId, param) {
	var param  = param ? param : [];
	
	if (!param.yType) param.yType = "sum"; 

	var width  = d3.select(divId).style("width");
	if (width.match(/\d+px/)) {
		width = +width.replace(/px$/, "");
	}else if (width.match(/\d+%$/)) {
		width = (+width.replace(/%$/, ""))/100*document.body.scrollWidth;
	}else{
		width = 400;
	}
	if(!param.width)param.width = {};
	param.width[divId] = width;

	var height = d3.select(divId).style("height");
	if (height.match(/\d+px/)) {
		height = +height.replace(/px$/, "");
	}else if (height.match(/\d+%$/)) {
		height = (+height.replace(/%$/, ""))/100*document.body.scrollHeight;
	}else{
		height = 300;
	}
	if(!param.height)param.height = {};
	param.height[divId] = height;
	
	if (!param.padding) param.padding = {top:50, left: 50, right: 50, bottom: 50};
	
	var color = d3.scale.category10();
	if (!param.mouseoverColor || !param.mouseoutColor) {
		param.mouseoverColor = [];
		param.mouseoutColor = [];
		for (var i=0; i<100; i++){
			param.mouseoutColor.push(color(i));
			param.mouseoverColor.push(d3.rgb(color(i)).brighter().toString());
		}
	}
	
	return param;
}
//------------------------------------------------------------------------------------------
function initSvg(gType, divId, origData, xField, initRc, param, title) {
	//setup callbacks
	if (param.filters) {
		if(!param.filters.cb) param.filters.cb = {};
		if(!param.filters.cb[divId]) param.filters.cb[divId] = {};
		var p = param.filters.cb[divId];
		p.gType = gType, p.origData = origData, p.xField = xField, p.yFields = initRc.yFields, 
		p.initRc = initRc, p.param = param, p.title = title;
	}
	
	if (gType == 'table') {
		var svg = d3.select(divId).select("table");
		if (!svg[0][0]) {
			if (title) {
				d3.select(divId).append("center").append("h3").text(title);
			}
			svg = d3.select("div" + divId).append("table").attr("class", "svg");
		}
		param.filters.cb[divId].svg = svg; // save for callback.
		return svg;		
	}
	
	var svg = d3.select(divId).select("svg");
	if (!svg[0][0]) {
		svg = d3.select(divId)
				.append("svg")
				.attr("width", param.width[divId])
				.attr("height", param.height[divId]);
		
		if (title){
			var t1, t2;
			if (title instanceof Array){
				t1 = title[0];
				t2 = title[1];
			}else{
				t1 = title;
			}
			var x = (param.width[divId] - param.padding.right + param.padding.left)/2;
			//if (/*gType == 'bar' ||*/ gType == 'column' || gType == 'curve' || gType == 'area') {
			//	x -= 60;
			//}
			var y = 21;
			if (t1) {
				svg.append("text")
					.attr("class", "svg_title")
					.text(t1)
					.attr({x:x, y:y})
			}
			if (t2) {
				y += 20;
				svg.append("text")
					.attr("class", "svg_subtitle")
					.text(t2)
					.attr({x:x, y:y})
			}
			
		}
		switch (gType){
			case 'pie':
			case 'bubble':
				svg.append("g")
					.attr("class", "pie_group");
			break;
			case 'map':
				var container = svg.append("g").attr("class", "container");
				container.append("g").attr("class", "paths");
				container.append("g").attr("class", "circles");
				container.append("g").attr("class", "texts");
			break;
			case 'bar':
			case 'column':
			case 'curve':
			case 'area':
				var plotArea = svg.append("g").attr("class", "plotArea");
				plotArea.append("g").attr("class", "xAxis");
				plotArea.append("g").attr("class", "yAxis");
				plotArea.append("g").attr("class", "yAxis2");
			break;
			case 'sankey':
			case 'force':
				svg = svg.append("g")
						.attr("transform", "translate(" + param.padding.left + "," + param.padding.top + ")");
			break;
			default:
			return;
		}
		if (param.width[divId] >= 200 && param.height[divId] >= 150){
			// create xField text
			var x = param.padding.left - 6;
			var y = param.height[divId] - param.padding.bottom + 16;
			var anchor = "end";
			if (gType == 'bar') {
				x -= 6;
				y = param.padding.top - 10;
			}
			else if (gType == "pie" || gType == "bubble"){
				x = (param.width[divId] + param.padding.left - param.padding.right)/2;
				anchor = "middle";
			}
			svg.append("text")
				.text(xField)
				.attr({x: x, y: y, "text-anchor": anchor, "fill": "lightblue"});
			if (param.yUnit){
				svg.append("text")
					.text("(" + param.yUnit + ")")
					.attr({x: x, y: param.padding.top-15, "text-anchor": anchor, "fill": "#888"});
			}		
			
			// create yField text
			if (initRc.legend) {
				var x = param.padding.left -4;
				var y = param.padding.top - 8;
				anchor = "start";
				if (gType == 'pie' || gType == "bubble") {
					x = (param.width[divId] + param.padding.left - param.padding.right)/2;
					anchor = "middle";
				}else if (gType == "bar"){
					y -= 20;
					x += 10;
				}
				
				svg.append("text")
					.text("Legend: " + initRc.legend)
					.attr({x: x, y: y, "text-anchor": anchor, "fill": "lightblue"});
			}
		}
	}
	if (param.filters) {
    	param.filters.cb[divId].svg = svg; // save for callback.
    }
	return svg;
} // function initSvg
	
//--------------------------------------------
function drawIcons(gType, divId, svg, yFields, param){
	if (param.hideLegend) return;
	if (gType != 'pie'  && gType != "bubble" && gType != 'bar' && gType != 'column' && gType != 'curve' && gType != 'area') return;
	if (param.width[divId] < 300 || param.height[divId] < 200) {
		console.log(divId + " has no space to draw icons. Display condition: width must > 300, height must > 200.");
		return;
	}

	var shows = param.shows[divId];
	
	var iconShowNbr = 0;
	yFields.forEach(function(d, i){
		if (shows[i].data) {
			iconShowNbr++;
		}
	})
	if (iconShowNbr <= 1) return;

	svg.select("g.icons").remove();  // always to redraw to avoid being covered.
	
	var iy = 0;
	var elemClass = {pie: "path.arc", bar: "rect.bar", column: "rect.bar", area: "path.area.data_", curve: "path.curve.data_"};
	svg.append("g")
		.attr("class", "icons")
		.selectAll("g.icon")
		.data(yFields)
		.enter()
		.append("g")
		.attr("class", "icon")
		.each(function(d,i){
			var x = param.width[divId] - 100/*170*/;
			var y = iy * 16 + 50;
			var y2 = (iconShowNbr-iy-1) * 16 + 50;
			if (gType == 'bar'){
				y = param.padding.top + 100 + 16 * iy;
				y2 = y;
				x -= 20;
			}
			if (i==0) {
				d3.select(this)
					.append("rect")
					.attr({x:x-4, y:y-4, width:100/*204*/, height: iconShowNbr*16 + 2, fill: "#eee", opacity: 0.5, stroke: "#888", "stroke-width": 0, "shape-rendering": "crispEdges"})
			}
			if (shows[i].data == 0) return;
			iy++;
			
			d3.select(this)
				.attr("opacity", shows[i].on ? 1 : 0.3)
				.append("rect").attr("class", "bg")
				.attr({x: x, y: y2, width: 200, height: 12, fill: "#eee", opacity: 0})
				.on("mouseover", function(){
					d3.select(this).attr("opacity", 0.8);
					d3.select(this.parentNode).selectAll("text.fg").style("fill", param.mouseoverColor[i]);
					if (!shows[i].on) return;
					d3.select(this.parentNode).selectAll("rect.fg").style("fill", param.mouseoverColor[i]);
					if (gType == 'curve'){
						svg.selectAll(elemClass[gType]+i)
							.style("stroke", param.mouseoverColor[i])
							.style("stroke-width", 5);
						svg.selectAll('circle.col1.col1_'+i)
							.style("fill", param.mouseoverColor[i])
					}else{
						svg.selectAll(elemClass[gType]+i)
							.style("fill", param.mouseoverColor[i]);
					}
					showTip(this, param, "click to select / deselect <br>(hold to drag)");
					setTimeout(hideTip, 5000);
				})
				.on("mouseout", function(){
					d3.select(this).attr("opacity", 0);
					d3.select(this.parentNode).selectAll("text.fg").style("fill", param.mouseoutColor[i]);
					if (!shows[i].on) return;
					d3.select(this.parentNode).selectAll("rect.fg").style("fill", param.mouseoutColor[i]);
					if (gType == 'curve'){
						svg.selectAll(elemClass[gType]+i)
							.style("stroke", param.mouseoutColor[i])
							.style("stroke-width", 2);
						svg.selectAll('circle.col1.col1_'+i)
							.style("fill", param.mouseoutColor[i])
					}else{
						svg.selectAll(elemClass[gType]+i)
							.style("fill", param.mouseoutColor[i]);
					}
					hideTip();
				})
				.on("click", function(){
					if (shows[i].on == 1) {
						var allShow = true;
						shows.forEach(function(d) {
							if(d.on==0) allShow = false;
						});
						if (allShow) {
							shows.forEach(function(d){
								d.on = 0;
							})
							shows[i].on = 1;
						}else{
							shows[i].on = 0;
						}
					}else{
						shows[i].on = 1;
					}
					
					checkAllHideAndRedraw();
				});
				
			d3.select(this)
				.append("rect").attr("class", "fg")
				.attr({x: x, y: y2, width: 14, height: 12, fill: shows[i].on ? param.mouseoutColor[i] : "#eee"})
				.on("mouseover", function(){
					if (shows[i].on == 1) {
						d3.select(this).style("fill", "#eee");
					}
					showTip(this, param, "click to hide me");
					setTimeout(hideTip, 5000);
				})
				.on("mouseout", function(){
					if (shows[i].on == 1) {
						d3.select(this).style("fill", param.mouseoutColor[i]);
					}
					hideTip();
				})
				.on("click", function(){
					if (shows[i].on == 1) {
						shows[i].on = 0;
					}
					checkAllHideAndRedraw();
				});
			
			d3.select(this)
				.append("text").attr("class", "fg")
				.text(d.substr(0,30))
				.attr({x: x+16, y: y2+10, fill: param.mouseoutColor[i]});
				
			function checkAllHideAndRedraw(){
				var allHide = true;
				shows.forEach(function(d) {
					if(d.on==1) allHide = false;
				});
				if (allHide) {
					shows.forEach(function(d){
						d.on = 1;
					})
				}
				
				__redraw(divId, param);
			}

		})
		
		var drag = d3.behavior.drag()
				.on("drag", function(d,i) {
					d.x += d3.event.dx
					d.y += d3.event.dy
					d3.select(this).attr("transform", function(d,i){
						return "translate(" + [ d.x,d.y ] + ")"
					})
				});
	
		if(!param.iconsPos)param.iconsPos = {};
		if(!param.iconsPos[divId]) param.iconsPos[divId] = {x:0, y:0};
		svg.select("g.icons")
			.datum(param.iconsPos[divId])
			.attr("transform", function(d,i){
						return "translate(" + [ d.x,d.y ] + ")"
					})
			.call(drag);
		
} // function drawIcons


//-----------------------------------------------------------------------------------------------	
// create Y axis.
function appendYAxises (plotArea, yAxis, width, padding) {
	plotArea.select("g.yAxis")
		.attr("transform", "translate(" + padding.left + ",0)")
		.transition().duration(duration)
		.call(yAxis);
	plotArea.select("g.yAxis2")
		.attr("transform", "translate(" + padding.left + ",0)")
		.transition().duration(duration)
		.call(yAxis.tickSize(-(width-padding.left-padding.right),0,0).tickFormat(""));
}

//-----------------------------------------------------------------------------------------------	
// filters = [{divId: divId1, values:{value1: 1, value2: 1, ...} }, ...]
function getFilterById(divId, filters){
	if (!filters) return -1;
	if (!filters.f) filters.f = []; // init it if not existing.
	for (var i=0; i<filters.f.length; i++) {
		if (filters.f[i].divId == divId) return i;
	}
	return -2;
}
//-----------------------------------------------------------------------------------------------	
function doFilter(divId, param, xField, value) {
	var fIdx = getFilterById(divId, param.filters);
	if (fIdx == -1) return;

	if (fIdx >= 0) {
		var values = param.filters.f[fIdx].values;
		if (values[value] == 1) {
			delete values[value]; // remove the filter for this value.
			if (d3.keys(values).length == 0){
				param.filters.f.splice(fIdx,1); // remove this filter.
			}
		}else{
			if (param.filters.single) { // reset all if only single allowed.
			    d3.keys(values).forEach(function(value){delete values[value];});
			}
			values[value] = 1;
		}
	}else{
		var values = {};
		values[value] = 1;
		param.filters.f.push({divId: divId, xField: xField, values: values});		
	}
	
	// redraw all.
	// 1st, redraw myself.
	__redraw(divId, param);
	
	// then, redraw others who has same filter as mine.
	var myIdx = 0;
	d3.keys(param.filters.cb).forEach(function(d,i){
		if (d == divId) myIdx = i;
	})
	d3.keys(param.filters.cb).forEach(function(d,i){
		if (d == divId) return;
		var c = param.filters.cb[d];
		
		//__redraw(d, c.param);
		setTimeout(redrawOtherCharts(c), Math.abs(myIdx-i)*100);
		
		function redrawOtherCharts(c){
			return function(){
				__redraw(d, c.param);
			}
		}
	})
}

//-----------------------------------------------------------------------------------------------	
function showTip(domId, param, content){
	if (param.hideTooltip) return;

	//Show the tooltip
	var tooltip = d3.select("div#tooltip");
	if (tooltip[0][0] == null) {
		d3.select("body")
			.append("div")
			.style("opacity", 0.9)
			.style("filter", "alpha(opacity:90)")
			.attr("id", "tooltip")
			.append("p")
			.append("span");
	}
		
	var oRect = domId.getBoundingClientRect();
	var scrollLeft = document.documentElement.scrollLeft || window.pageXOffset || document.body.scrollLeft;
	var scrollTop  = document.documentElement.scrollTop  || window.pageYOffset || document.body.scrollTop;
    x = scrollLeft + (oRect.left + oRect.width /2);
    y = scrollTop  + (oRect.top  + oRect.height/2);

	//Update the tooltip position and content
	d3.select("#tooltip")
		.classed("hidden", false)
		.style("left", x + "px")
		.style("top", y + "px")						
		.select("span")
		.html(content);
}

function hideTip(){
	//Hide the tooltip
	d3.select("div#tooltip").classed("hidden", true);
}
//-------------------------------------------------------------------
function getIdxTotal(divId, dataset, param, i0) {
	var nIdx = 0, nTotal = 1;
	if (param.listed) {
		nIdx =0, nTotal = 0;
		dataset.forEach(function(f, iii){
			if (param.shows[divId][iii].on > 0 && param.shows[divId][iii].data > 0) {
				nTotal++;
			}
			if (i0 == iii) {
				nIdx = nTotal -1;
			}
		})
		if (nTotal == 0){
			nIdx = i0, nTotal = dataset.length;
		}
	}
	return [nIdx, nTotal];
}				
//-------------------------------------------------------------------
/* return: 1 - this chart is filtered. and this element is filtered.
           0 - this chart is filtered, but this element is not.
          -1 - this HTML page has no filter.
          -2 - this HTML page has a filter, but chart is not filtered.
*/
var filterIn = function(divId, param, x) {
	var fIdx = getFilterById(divId, param.filters);
	if (fIdx < 0) {
		return fIdx; // -1 or -2
	}else{
		if (param.filters.f[fIdx].values[x]) {
			return 1; // filtered but in.
		}
	}
	return 0; // filtered out.
}
//-------------------------------------------------------------------
function addEvents(svg, dataset, divId, param, xField, yFields) {
	svg.selectAll("g.bar")
		.data(dataset[0])
		.on("mouseover",function(d,i){
			if (filterIn(divId, param, d.x)==1) return;
			var grp1 = d3.select(this);
			grp1.select("rect.hidbar")
				.style("opacity", 0.1);
			dataset.forEach(function(d0, i0){ // N.A. for area/curve, just keep it here.
				grp1.select("rect.bar"+i0)
					.style("fill", param.mouseoverColor[i0]);
			});
		})
		.on("mouseout", function(d,i){
			if (filterIn(divId, param, d.x)==1) return;
			var grp1 = d3.select(this);
			grp1.select("rect.hidbar")
				.style("opacity", 0);
			dataset.forEach(function(d0, i0){
				grp1.select("rect.bar"+i0)
					.style("fill", param.mouseoutColor[i0]);
			});
		})
		.on("click", function(d,i){
			doFilter(divId, param, xField, d.x);
		})
		.on("dblclick", function(d,i){
			console.log(this);
		})
		.each(function(d,i){
			var grp1 = d3.select(this);
			grp1.select("rect.hidbar")
				.on("mouseover", function(){
						var total = 0;
						dataset.forEach(function(v){total += v[i].y})
						showTip(this, param, "<b>" + d.x + "</b><br>Total: " + format(param, total, "yUnit"));
				})
				.on("mouseout", function(){
						hideTip(this);
				})
			
			dataset.forEach(function(d0, i0){
				grp1.select("rect.bar"+i0)
					.on("mouseover", function(){
						showTip(this, param, "<b>" + d.x + "</b><br>" + yFields[i0] + "<br>" + format(param, dataset[i0][i].y, "yUnit"));
					})
					.on("mouseout", function(){
						hideTip(this);
					})
				})
		});
}		

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__bar = function(divId, svg, dataset, xField, yFields, param, title){
	bar_column(divId, svg, dataset, xField, yFields, param, title, "bar");
}

yableau.__column = function(divId, svg, dataset, xField, yFields, param, title){
	bar_column(divId, svg, dataset, xField, yFields, param, title, "column");
}
function bar_column(divId, svg, dataset, xField, yFields, param, title, gType){
	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];

	// barNbr is the max bar nbr to avoid too narrow bars.
	if (param.barNbr && param.barNbr < dataset[0].length) {
		if (gType == 'bar') {
			height = dataset[0].length * (height - padding.top - padding.bottom)/param.barNbr + padding.top + padding.bottom;				
			svg.attr("height", height);
		}else{
			width = dataset[0].length * (width - padding.left - padding.right)/param.barNbr + padding.left + padding.right;
			svg.attr("width", width);
		}
	}

	var plotArea = svg.select("g.plotArea");
	if (gType == 'bar'){
		var t = width;  width = height;  height = t;
		var padding2 = {left: padding.top, right: padding.bottom, bottom: padding.left, top: padding.right};
		padding = padding2;
		plotArea.attr("transform", "translate(" + height + ",0)rotate(90)")
	}
	
	var min_max = biStack(dataset, param.listed);
	
	// setup X scale
	xScale = d3.scale.ordinal()
			.domain(d3.range(dataset[0].length))
			.rangeRoundBands([padding.left, width - padding.right], 0.25); //0.25=ratio of blank / bar.
	
	//Define X axis
	xAxis = d3.svg.axis()
			.scale(xScale)
			.orient("bottom");

	// setup Y scale
	yScale = d3.scale.linear()
		.domain(param.yDomain ? param.yDomain : min_max)
		.range([height - padding.bottom, padding.top]);

	//Define Y axis
	yAxis = d3.svg.axis()
			  .scale(yScale)
			  .orient("left")
			  .ticks(param.yTickNbr ? param.yTickNbr : 3); // tick counts.

	// draw groups, each group has a hidden bar, a bar, and a text.	
	var bars =  plotArea.selectAll("g.bar")
						.data(dataset[0]);

	bars.enter()
		.append("g")
		.attr("class", "bar")
		.each(function(d,i){
			var grp1 = d3.select(this);
			grp1.attr("transform", "translate(" + xScale(i) + "," + padding.top + ")")
				.append("rect")
				.attr("class", "hidbar")
				.style("fill", "#000")
				.style("opacity", 0);
			dataset.forEach(function(d0,i0){
				grp1.append("rect")
					.attr("class", "bar"+i0)
					.attr("y", yScale(0)-padding.top)
					.attr("height", 0)
					.attr("width", xScale.rangeBand());
				grp1.append("text")
					.attr("class", "bar"+i0)
					.attr("transform", "translate(0," + (yScale(0)-padding.top) + ")")
					.style({fill:"#000", "text-anchor":"middle"});
			});
		});
		
	bars.exit()
		.transition().duration(duration)
		.style("opacity", 0)
		.remove();
		
	bars.each(function(d,i){
		var grp1 = d3.select(this);
		grp1.transition().duration(duration)
			.attr("transform", "translate(" + xScale(i) + "," + padding.top + ")")
			.style("opacity", filterIn(divId, param, d.x) ? 1 : 0.3)
			
		grp1.select("rect.hidbar")
			.attr("width", xScale.rangeBand())
			.attr("height", height - padding.top - padding.bottom + 10)
			.attr("y", -10)
			.style("opacity", filterIn(divId, param, d.x)==1 ? 0.1 : 0);
		
		dataset.forEach(function(d0,i0){
			var nIdxTotal = getIdxTotal(divId, dataset, param, i0);
			var nIdx = nIdxTotal[0], nTotal = nIdxTotal[1];
			
			var d = d0[i];
			grp1.select("rect.bar"+i0)
				.style("fill", filterIn(divId, param, d.x)==1 ? param.mouseoverColor[i0] : param.mouseoutColor[i0])
				.transition().duration(duration)
				.style("opacity", 1)
				.attr("x", xScale.rangeBand()/nTotal * nIdx)
				.attr("width", xScale.rangeBand()/nTotal)
				.attr("y", yScale(d.y0 + Math.abs(d.y)) - padding.top)
				.attr("height", Math.abs(yScale(d.y) - yScale(0)));
				
			grp1.select("text.bar"+i0)
				.text(d.y ? format(param, d.y) : "")
				.style("opacity", param.hideText ? 0 : 1)
				.transition().duration(duration)
				.attr("transform", function(){
					var x = xScale.rangeBand()/nTotal * (nIdx+0.5);
					
					var y = 0;
					if (param.listed){
						if (gType == 'bar') {
                            if (d.y >= 0) {
                                y = yScale(d.y0 + d.y) - padding.top;
                                if (y > (height-padding.top-padding.bottom)/2){
                                    d3.select(this).style({fill:"#000", "text-anchor":"start"});
                                    y -= 5;
                                }else{
                                    d3.select(this).style({fill:"#fff", "text-anchor":"end"});
                                    y += 2;
                                }
                            }else{
                                 y = yScale(d.y0      ) - padding.top;
                                if (y > (height-padding.top-padding.bottom)/2){
                                    d3.select(this).style({fill:"#fff", "text-anchor":"start"});
                                    y -= 2;
                                }else{
                                    d3.select(this).style({fill:"#000", "text-anchor":"end"});
                                    y += 3;
                                }
                            }
						}else{
							if (d.y >= 0 ) y = yScale(d.y0 + d.y) - padding.top -  4;
    						else           y = yScale(d.y0      ) - padding.top + 13;
						}
					}else{
						y = yScale(d.y0 + Math.abs(d.y)/2) - padding.top;
						
						if (gType == 'column') y+=4;
					}
					
					if (gType == 'bar') return "translate(" + (x+5) + "," + y +")rotate(-90)";
					else                return "translate(" +  x    + "," + y +")";
				});
		});
	})
		
	addEvents(plotArea, dataset, divId, param, xField, yFields);
	
	//Create Y axis
	if (!param.hideYaxis)	appendYAxises (plotArea, yAxis, width, padding);
	
	if (gType == 'bar'){
		plotArea.selectAll("g.yAxis text")
				.attr("transform", "translate(-11,-9)rotate(-90)")
				.style("text-anchor", "middle");
	}

	//Create X axis
	plotArea.select("g.xAxis")
		.attr("transform", "translate(0, " + yScale(0) + ")")
		.transition().duration(duration)
		.call(xAxis)
		
	var totalXtextSize = 0;
	dataset[0].forEach(function(d,i) {
		totalXtextSize += d.x.length;
	})
	
	dataset[0].forEach(function(d,i) {
		var allNeg = true;
		var allZero = true;
		dataset.forEach(function(data){
			if (data[i].y > 0) allNeg = false;
			if (data[i].y < 0) allZero = false;
		})

		if (gType == 'bar' || totalXtextSize * 8 > (width-padding.left-padding.right)){
			if (allNeg && !allZero) {
				d.attr_y = "-15";
				d.line_attr_y2 = "-6";
				d.transform = "translate(12,-7)rotate(-90)";
				d.text_anchor = "start";
			}else{
				d.attr_y = "9";
				d.line_attr_y2 = "6";				
				d.transform = "translate(-13,7)rotate(-90)";
				d.text_anchor = "end";
			}
		}else{
			if (allNeg && !allZero) {
				d.attr_y = "-15";
				d.line_attr_y2 = "-6";
				d.transform = "";
				d.text_anchor = "middle";
			}else{
				d.attr_y = "9";
				d.line_attr_y2 = "6";				
				d.transform = "";
				d.text_anchor = "middle";
			}
		}
	})
	
	plotArea.selectAll("g.xAxis text")
		.data(dataset[0])
		.each(function(d,i){
			d3.select(this)
				.attr("transform", d.transform)
				.transition().duration(duration)
				.attr("y", d.attr_y)
				.style("text-anchor", d.text_anchor);
			d3.select(this.parentNode)
				.select("line")
				.transition().duration(duration)
				.attr("y2", d.line_attr_y2);
		})
		.text(function(d,i){
			return d.x;
		})
		.style("opacity", function(d,i){
			return filterIn(divId, param, d.x) ? 1 : 0.3;
		})
} // bar_column()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__area = function(divId, svg, dataset, xField, yFields, param, title){
	area_curve(divId, svg, dataset, xField, yFields, param, title, "area");
}

yableau.__curve = function(divId, svg, dataset, xField, yFields, param, title){
	area_curve(divId, svg, dataset, xField, yFields, param, title, "curve");
}

function area_curve(divId, svg, dataset, xField, yFields, param, title, gType){
	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];
		
	var min_max = biStack(dataset, param.listed);
	
	// setup X scale
	var xScale;
	var timeParse;
	var colWid = 0, 
		colWid2 = dataset[0].length == 1 ? 0 : (width - padding.right - padding.left)/(dataset[0].length-1);

	var xType = (param.xType && param.xType == "time")? "time" : "ordinal";

	if (xType == "ordinal") {
		xScale = d3.scale.ordinal()
			.domain(d3.range(dataset[0].length))
			.rangeRoundBands([padding.left, width - padding.right], 0.25); //0.25=ratio of blank / bar.
		colWid = xScale.rangeBand();
		colWid2 = colWid;
	}else{		
		timeParse = d3.time.format(param.xTimeFormat).parse;
		xScale = d3.time.scale()
			.domain(d3.extent(dataset[0], function(d,i){
				return timeParse(d.x); // convert to string.
			}))
			.range([padding.left, width - padding.right]);
	}
			
	//Define X axis
	xAxis = d3.svg.axis()
			.scale(xScale)
			.orient("bottom");
			
	if (xType == "time") {
		if (param.xTick){
			if (param.xTick.interval) {
				if (param.xTick.step){
					xAxis.ticks(d3.time[param.xTick.interval], param.xTick.step);
				}else{
					xAxis.ticks(d3.time[param.xTick.interval]);
				}
			}
			if (param.xTick.format){
				xAxis.tickFormat(d3.time.format(param.xTick.format));
			}
		}else{
			xAxis.ticks(param.xTickNbr ? param.xTickNbr : 10 ); // default is 10 auto ticks.
		}
	}

	// setup Y scale
	yScale = d3.scale.linear()
		.domain(param.yDomain ? param.yDomain : min_max)
		.range([height - padding.bottom, padding.top]);

	//Define Y axis
	yAxis = d3.svg.axis()
			  .scale(yScale)
			  .orient("left")
			  .ticks(param.yTickNbr ? param.yTickNbr : 3); // tick counts.

	var interpolate = xType == "time" ? 'basis' : 'monotone'; /*"basis | cardinal | monotone | linear"*/ 
			  
	var d3_line = gType=="area" ? d3.svg.area() : d3.svg.line();	
	d3_line.x(function(d,i) { 
				if (xType == "ordinal") return xScale(i) + colWid/2;
				return xScale(timeParse(d.x));
			})
			.interpolate(interpolate);

	if (gType == "area") {
		d3_line.y0(function(d) { return yScale(d.y0 + ( d.y>0 ? d.y : 0 )); })
			   .y1(function(d) { return yScale(d.y0); });
	}else{
		d3_line.y(function(d){return yScale(d.y0 + ( d.y>0 ? d.y : 0 ));});
	}

	// for init effect.
	var d3_line_init = gType=="area" ? d3.svg.area() : d3.svg.line();	
	d3_line_init.x(function(d,i) { 
				if (xType == "ordinal") return xScale(i) + colWid/2;
				return xScale(timeParse(d.x));
			})
			.interpolate(interpolate);

	if (gType == "area") {
		d3_line_init.y0(function(d) { return yScale(0); })
			        .y1(function(d) { return yScale(0); });
	}else{
		d3_line_init.y(function(d){return yScale(0);});
	}

	// draw a curve or area.
	var plotArea = svg.select("g.plotArea");
	
	var barArea = plotArea.select("g.barArea");
	var pathArea = plotArea.select("g.pathArea");
	if (!barArea[0][0]){
		if (gType == 'area') {
			barArea = plotArea.append("g").attr("class", "barArea");
			pathArea = plotArea.append("g").attr("class", "pathArea");
		}else{
			pathArea = plotArea.append("g").attr("class", "pathArea");
			barArea = plotArea.append("g").attr("class", "barArea");
		}
	}
	
	var pths = pathArea.selectAll("path." + gType)
						 .data(dataset);
						 
	pths.enter()
		.append("path")
		.attr("d", function(d){
			return d3_line_init(d);
		})
		.attr("class", function(d,i){
				return gType + " data_"+i;
		});

	pths.exit()
		.remove();
		
	var show = function(i0){
		return param.shows[divId][i0].on > 0; 
	}
	
	pths.on("mouseover", function(d, i0){
			if (!show(i0))return;
			if (gType == "area"){
				d3.select(this).style("fill", param.mouseoverColor[i0]);				
			}else{
				d3.select(this).style("stroke-width", 5); 
			}
			showTip(this, param, "<b>" + yFields[i0] + "</b><br>Average: " + average(d));
			function average(d){
				var xTotal = 0;
				var xCount = 0;
				d.forEach(function(d){
						xTotal += d.y * d.c;
						xCount += d.c;
					});
				return format(param, xTotal / xCount);
			}
		})
		.on("mouseout", function(d, i0){
			if (!show(i0))return;
			if (gType == "area"){
				d3.select(this).style("fill", param.mouseoutColor[i0]);				
			}else{
				d3.select(this).style("stroke-width", 2); 
			}
			hideTip(this);
		})
		.transition().duration(duration) 
		.attr("d", function(d,i0) {
			d3.select(this)
				.style("fill", gType == "area" ? param.mouseoutColor[i0] : "none")  //note: .style() > style in css file > .attr{}
				.style("stroke", param.mouseoutColor[i0])
				.style("stroke-width", show(i0)?1:0);

			if (param.noZeroStartNoZeroEnd) {
				if (!d[0]) return;
				
				var dx = d.filter(function(d){return d.y != 0;});
				if(dx.length == 0) return;
				
				var translate = 0;
				while(d[0].y == 0){
					d = d.slice(1);
					translate++;
				}
				while(d[d.length-1].y == 0) {
					d = d.slice(0, d.length-1);
				}
				if (translate){
					var xScale_0 = (xType == "ordinal") ? xScale(0) : xScale(timeParse(d[0].x));
					var xScale_i = (xType == "ordinal") ? xScale(translate) : xScale(timeParse(d[i0].x));

					d3.select(this).attr("transform", "translate(" + (xScale_i-xScale_0) + ",0)");
				}else{
					d3.select(this).attr("transform", null);
				}
			}
			
			return d3_line(d);
		});
		
		
	///////////////////////////////////////////////////////////////////////
	// to get good view, do not draw too many columns and circles!
	var noCirles = d3.keys(param.xFieldSeq[divId]).length > 50 || xType == "time";
	
	// draw groups, each group has a hidden bar, a *circle*, and a text.
	var bars = barArea.selectAll("g.bar")
					  .data(dataset[0]);
	bars.enter()
		.append("g")
		.attr("class", "bar")
		.each(function(d,i){
			var grp1 = d3.select(this);
			var xScale_i = (xType == "ordinal") ? xScale(i) : xScale(timeParse(d.x));
			grp1.attr("transform", "translate(" + xScale_i + "," + padding.top + ")")
				.append("rect")
				.attr("class", "hidbar")
				.style("fill", "#888")
				.style("opacity", 0);

			if (noCirles) return;

			dataset.forEach(function(d0,i0){
				if (param.noZeroStartNoZeroEnd && d0[i].y == 0) return;
				
				grp1.append("circle")
					.attr("class", "col1 col1_"+i0)
					.attr("cx", colWid/2)
					.attr("cy", yScale(0)-padding.top)
					.attr("r", 6);
				grp1.append("circle")
					.attr("class", "col2 col2_"+i0)
					.attr("cx", colWid/2)
					.attr("cy", yScale(0)-padding.top)
					.attr("r", 3);
				grp1.append("text")
					.attr("class", "col_"+i0)
					.attr("y", yScale(min_max[0]) - 10 - padding.top)
					.style({fill:"#000", "text-anchor":"middle"});
			});
		});
		
	bars.exit()
		.remove();
		
	bars.each(function(d,i){
			var dur2 = duration;//*Math.random();
			var grp1 = d3.select(this);
			var xScale_i = (xType == "ordinal") ? xScale(i) : xScale(timeParse(d.x));
			
			grp1.transition().duration(dur2)
				.attr("transform", "translate(" + xScale_i + "," + padding.top + ")")
				.style("opacity", filterIn(divId, param, d.x) ? 1 : 0.5);
				
			grp1.select("rect.hidbar")
				.attr("width", d3.max([colWid2,10]))
				.attr("x", xType=="time" ? (0-d3.max([colWid2,10])/2) : 0)
				.attr("y", -10)
				.attr("height", height - padding.top - padding.bottom + 10)
				.style("opacity", /*(fIdx >= 0 && values[d.x])*/filterIn(divId, param, d.x)==1 ? 0.1 : 0);
			
			dataset.forEach(function(d0,i0){
				var d = d0[i];
				var op = 1;
				
				if (param.noZeroStartNoZeroEnd && d.y == 0) op=0;
				
				var yyy = yScale(d.y0 + ( d.y>0 ? d.y : 0 )) - padding.top;
				grp1.select("circle.col1_"+i0)
					.style("fill", filterIn(divId, param, d.x)==1 ? param.mouseoverColor[i0] : param.mouseoutColor[i0])
					.on("mouseover", function(){
						if (!show(i0))return;
						pathArea.select("path.data_"+i0).style("stroke-width", 5);
					})
					.on("mouseout", function(){
						if (!show(i0))return;
						pathArea.select("path.data_"+i0).style("stroke-width", 2);
					})
					.transition().duration(dur2)
					.style("opacity", op)
					.attr("cx", colWid/2)
					.attr("cy", yyy)
					.attr("r", show(i0)?6:0);
					
				grp1.select("circle.col2_"+i0)
					.on("mouseover", function(){
						if (!show(i0))return;
						showTip(this, param, "<b>" + d.x + "</b><br>" + yFields[i0] + "<br>" + format(param, d.y, "yUnit"));
						pathArea.select("path.data_"+i0).style("stroke-width", 5);
					})
					.on("mouseout", function(){
						if (!show(i0))return;
						hideTip(this);
						pathArea.select("path.data_"+i0).style("stroke-width", 2);
					})
					.transition().duration(dur2)
					.style("opacity", op)
					.attr("cx", colWid/2)
					.attr("cy", yyy)
					.attr("r", show(i0)?3:0);
					
				grp1.select("text.col_"+i0)
					.text(d.y ? format(param, d.y) : "")
					.attr("x", colWid/2)
					.style("opacity", param.hideText ? 0 : op)
					.transition().duration(dur2)
					.attr("y", function(){
						var y = yyy - 10;
						if (d0.length < 2) return y;
						if (i==0){
							if(d.y < d0[i+1].y) 
								y += 30;
						}else if (i==d0.length-1) {
							if (d.y < d0[d0.length-2].y)
								y += 30;
						}else if (d.y < d0[i-1].y && d.y < d0[i+1].y) {
							y += 30;
						}
						if (y > height - padding.top - padding.bottom) {
							y -= 30;
						}
						return y;
					});
			});
		});

	addEvents(plotArea, dataset, divId, param, xField, yFields);

	//Create Y axis
	if (!param.hideYaxis) appendYAxises (plotArea, yAxis, width, padding);
	
	//Create X axis
	plotArea.select("g.xAxis")
		.attr("transform", "translate(0, " + yScale(0) + ")")
		.transition().duration(duration)
		.call(xAxis);
	
	if (xType == "ordinal") {
		var totalXtextSize = 0;
		plotArea.selectAll("g.xAxis text")
			.data(dataset[0])
			.text(function(d,i){
				totalXtextSize += d.x.length;
				return d.x;
			})
			.style("opacity", function(d,i){
				return filterIn(divId, param, d.x) ? 1 : 0.3;
			});
		if (totalXtextSize * 8 > (width-padding.left-padding.right)){
			// too narrow to put X axis label, rotate -90 degree.
			plotArea.selectAll("g.xAxis text")
					.attr("transform", "translate(-13,7)rotate(-90)")
					.style("text-anchor", "end");
		}else{
			plotArea.selectAll("g.xAxis text")
					.attr("transform", null)
					.style("text-anchor", "middle");
		}
	}
	
} // yableau.area_curve()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__map = function(divId, svg, dataset, xField, yFields, param, title){

	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];

	var dataset = dataset[0];
	
	var vMax = d3.max(dataset, function(d){return Math.abs(d.y);}); // maybe return undefined!
	if (!vMax) vMax = 1;  // avoid 0 & negative error.

	var zoom = d3.behavior.zoom()
		.scaleExtent([0.1, 10])
		.on("zoom", zoomed);

	var container = svg.select("g.container")
						//.call(zoom);
		
	var projection = d3.geo.mercator()
						.center(param.mapInfo.center)
						.scale(param.mapInfo.scale)
    					.translate([width/2, height/2]);
	
	var path = d3.geo.path()
					.projection(projection);

	var features = param.mapInfo.features;
		
	var pths = container.select("g.paths")
						.selectAll("path")
						.data(features);
	pths.enter()
		.append("path");
		
	pths.exit()
		.remove();
	
	pths.attr("stroke-width",1)
		.style("fill", "rgb(245,243,240)")
		.each(function(d,i){
			if (filterIn(divId, param, d.properties.name)) {
				d3.select(this).style({'stroke': "#ddd", "opacity": 1});
			}else{
				d3.select(this).style({'stroke': "#ddd", "opacity": 0.5});
			}
		})
		.attr("d", path)
		.each(function(d,i){
			d.properties.position = path.centroid(d);
		})
		.on("mouseover",function(d,i){
			if (filterIn(divId, param, d.properties.name)==1) return;
			d3.select(this)
				.style("fill","#ddd");
		})
		.on("mouseout",function(d,i){
			if (filterIn(divId, param, d.properties.name)==1) return;
			d3.select(this)
				.style("fill", "rgb(245,243,240)");
		})
		.on("click", function(d,i){
			doFilter(divId, param, xField, d.properties.name);
		})
		.on("dblclick", function(d,i){
			console.log(this);
		});
		
	// put value circles.
	var cirs = container.select("g.circles")
						.selectAll("circle")
						.data(features)
	cirs.enter()
		.append("circle");
		
	cirs.exit()
		.remove();

	cirs.attr("class", "in_map")
		.attr("cx", function(d) {
			return projection([d.properties.cp[0], d.properties.cp[1]])[0];
		})
		.attr("cy", function(d) {
			return projection([d.properties.cp[0], d.properties.cp[1]])[1];
		})
		.each(function(d,i){
			if (filterIn(divId, param, d.properties.name)==1) {
				d3.select(this).style({'fill': param.mouseoverColor[0], 'stroke-width': 1, 'stroke': "#ddd", "opacity": 1  });
			}else{
				d3.select(this).style({'fill': param.mouseoutColor[0],  'stroke-width': 1, 'stroke': "#ddd", "opacity": 0.5});
			}
		})
		.on("mouseover",function(d,i){
			var y = 0;
			dataset.forEach(function(c,i){
				if (c.x == d.properties.name) y = c.y;
			});
			showTip(this, param, "<b>" + y + "</b>");
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.style("fill", param.mouseoverColor[0]);
		})
		.on("mouseout",function(d,i){
			hideTip(this);
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.style("fill", param.mouseoutColor[0]);
		})
		.on("click", function(d,i){
			doFilter(divId, param, xField, d.properties.name);
		})
		.on("dblclick", function(d,i){
			console.log(this);
		})
		//.transition().duration(duration)
		.attr("r", function(d) {
			var y = 0;
			dataset.forEach(function(c,i){
				if (c.x == d.properties.name) y = c.y;
			});
			return Math.sqrt(Math.abs(y / vMax * 700));  // here 700 is suitable for SAS. It's worse than auto config.
		});

	// put text on top.
	var txts = container.select("g.texts")
						.selectAll("text")
						.data(features);
	txts.enter()
		.append("text");

	txts.exit()
		.remove();
		
	txts.text(function(d,i){return d.properties.name;})
		.style("text-anchor", "middle")
		.attr("x",function(d){
			return projection([d.properties.cp[0], d.properties.cp[1]])[0];
		})
		.attr("y",function(d){
			return projection([d.properties.cp[0], d.properties.cp[1]])[1]+5;
		})
		.style("opacity", function(d,i){
			if (filterIn(divId, param, d.properties.name) == 0) {
				return 0.5;
			}else{
			    return 1;
			}
		});

	function zoomed() {
		container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	}
} // yableau.map()

//------------------------------------------------------------------------------------------
function multiDimTo1Dim(datasets){
	if (!datasets || !datasets[0] || !datasets[0][0]) return;

	var dataset = clone(datasets[0]);
	for (var j=0; j<dataset.length; j++) {
		for (var i=1; i<datasets.length; i++){
			dataset[j].y  += datasets[i][j].y;
			dataset[j]._y += datasets[i][j]._y;
		}
	}
	return dataset;
}
//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__pie = function(divId, svg, dataset, xField, yFields, param, title){
	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];
	var dataset = multiDimTo1Dim(dataset);

	// data is ready, now draw.
	var minDiameter = d3.min([width-padding.left-padding.right, height-padding.top-padding.bottom]);
	var outerRadius = minDiameter / 2;
	var innerRadius = minDiameter / 4;

	var data = [];
	var allZero = true;
	dataset.forEach(function(d,i){
		data.push(d.y);
		if (d.y) {
			allZero = false;
		}
	});
	
	if (allZero) {
		svg.selectAll("g.pie").remove();
		return -1;
	}
		
	var layout = d3.layout.pie();		
	var pie = layout(data);
	
	for(var i=0; i<data.length; i++){
		pie[i].x = dataset[i].x;

		var xi = param.xFieldSeq[divId][dataset[i].x];
		pie[i].color = param.mouseoutColor[xi];
		pie[i].mouseoverColor = param.mouseoverColor[xi];
	}
	
	var percentage = function(d){
		return Math.round((d.endAngle-d.startAngle)/2/PI*10000)/100 + "%";
	}
	
	var arc = d3.svg.arc()
					.innerRadius(innerRadius)
					.outerRadius(outerRadius);
					
	var tx = (width  - padding.right  + padding.left)/2 - outerRadius;
	var ty = (height - padding.bottom + padding.top )/2 - outerRadius;
		
	var arcs = svg.select("g.pie_group")
					.attr("transform", "translate(" + tx + "," + ty + ")")
					.selectAll("g.pie")
					.data(pie)
					.enter()
					.append("g")
					.attr("class", "pie")
					.attr("transform","translate(" + (outerRadius) + "," + (outerRadius) + ")");
					
	arcs.append("path")
		.attr("d", arc({value:1, data:1, startAngle:0, endAngle:PI/6, flag:0, color:"#000"}))
		.each(function(d) { this._current = d; }); // store the initial angles
	arcs.append("text").attr("class", "text1");
	arcs.append("text").attr("class", "text2");
	
	svg.selectAll("g.pie")
		.data(pie)
		.each(function(d,i){
			var fIdx = getFilterById(divId, param.filters);
			//var values = param.filters.f[fIdx].values;
			d3.select(this)
				.select("path")
				.attr("class", "arc"+i)
				.transition().duration(duration)
				.attrTween("d", arcTween)
				.style("opacity", .9)
				.style("fill", filterIn(divId, param, d.x)==1 ? d.mouseoverColor : d.color);
			
			var arcCent = arc.centroid(d);
			if (d.endAngle - d.startAngle >= PI/6) { // only show texts when more than 30deg.
				d3.select(this)
					.select("text.text1")
					.text(d.x)
					.attr({x: arcCent[0], y: arcCent[1]-7})
					.style("text-anchor","middle");
				d3.select(this)
					.select("text.text2")
					.text(percentage(d) + " (" + format(param, d.value) + ")")
					.attr({x: arcCent[0], y: arcCent[1]+7})
					.style("text-anchor","middle");
			}else{
				d3.select(this).select("text.text1").text("");
				d3.select(this).select("text.text2").text("");
			}
			
			if (filterIn(divId, param, d.x)==1) {
				d3.select(this)
					.select("path")
					.style({'fill': d.mouseoverColor, 'stroke-width': 1, 'stroke': "#444"});
				d3.select(this)
					.transition().duration(duration)
					.style("opacity", 1)
					.attr("transform","translate(" + (outerRadius+Math.sin((d.startAngle+d.endAngle)/2)*20) + "," 
												   + (outerRadius+Math.cos((d.startAngle+d.endAngle)/2)*(-20)) + ")");
			}else{
				d3.select(this)
					.select("path")
					.style({'fill': d.color, 'stroke-width': 1, 'stroke': "#ddd"});
				d3.select(this)
					.transition().duration(duration)
					.style("opacity", fIdx >= 0 ? 0.5 : 1)
					.attr("transform","translate(" + (outerRadius) + "," + (outerRadius) + ")");
			}
		})
		.on("mouseover",function(d){
			showTip(this, param, "<b>" + d.x + "</b><br>" + percentage(d) + "<br>" + format(param, d.value, "yUnit"));
			if (filterIn(divId, param, d.x)==1) return;
			d3.select(this).select("path")
				.style("fill", d.mouseoverColor);
		})
		.on("mouseout",function(d){
			hideTip();
			if (filterIn(divId, param, d.x)==1) return;
			d3.select(this).select("path")
				.style("fill", d.color);
		})
		.on("click", function(d){
			doFilter(divId, param, xField, d.x);
		})
		.on("dblclick", function(d,i){
			console.log(this);
		});
	
	svg.selectAll("g.pie")
		.data(pie)
		.exit()
		.remove();
		
	// from: http://bl.ocks.org/mbostock/1346410
	function arcTween(a) {
	  var i = d3.interpolate(this._current, a);
	  this._current = i(0);
	  return function(t) {
	    return arc(i(t));
	  };
	}		
} // yableau.pie()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__sankey = function(divId, svg, dataset, xField, yFields, param, title){
	var yField = yFields[0];
	var data = multiDimTo1Dim(dataset);
	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];

	// data conversion.
	data.forEach(function(d){
		var a = d.x.split(' -> ');
		d.source = a[0];
		d.target = a[1];
		d.value  = d.y;
	})
	
	var vMax = d3.max(data, function(d){return d.value;});

	// use log scale for small values.
	vScale = d3.scale.linear()
				.domain(param.yDomain ? param.yDomain : [0, vMax])
				.range([0, height/3]);
	data.forEach(function(d){
		d.showValue = d.value;     // keep for display.
		//d.value = vScale(d.value);
	});
		
	d3.select(divId).select("svg").remove();  // delete and redraw.
	d3.select(divId).append("svg")
			.append("rect")
			.attr("class", "bgRect")
			.attr("x",0)
			.attr("y",0)
			.attr("width",width)
			.attr("height",height);

	//-------------------------------------------------------------------------
	var units = param.units ? param.units : "Msg";

	// append the svg canvas to the page
	var svg = d3.select(divId).select("svg")
				.attr("width", width)
				.attr("height", height)
			  .append("g")
				.attr("transform", 
					  "translate(" + padding.left + "," + padding.top + ")");
			
	// Set the sankey diagram properties
	var sankey = d3.sankey()
					.nodeWidth(36)
					.nodePadding(10)
					.size([width-padding.left-padding.right, height-padding.top-padding.bottom]);

	var path = sankey.link();
  
	//set up graph in same style as original example but empty
	graph = {"nodes" : [], "links" : []};

	data.forEach(function (d) {
		graph.nodes.push({ "name": d.source });
		graph.nodes.push({ "name": d.target });
		graph.links.push({ "source": d.source,
							"target": d.target,
							"value": +d.value, "showValue": d.showValue });
	});

	// return only the distinct / unique nodes
	graph.nodes = d3.keys(d3.nest()
					  .key(function (d) { return d.name; })
					  .map(graph.nodes));

	// loop through each link replacing the text with its index from node
	graph.links.forEach(function (d, i) {
		graph.links[i].source = graph.nodes.indexOf(graph.links[i].source);
		graph.links[i].target = graph.nodes.indexOf(graph.links[i].target);
	});

	//now loop through each nodes to make nodes an array of objects
	// rather than an array of strings
	graph.nodes.forEach(function (d, i) {
		graph.nodes[i] = { "name": d };
	});
	
	sankey
		.nodes(graph.nodes)
		.links(graph.links)
		.layout(32);

	if (sankey.deadLoop()){
		svg.append("text")
			.text("Ooooops, there is dead loop in the source data :(")
			.style("font-size", "20px");
		return;
	}

	if (param.graphSpecialTreat){
		param.graphSpecialTreat(graph, width, height, padding);
	}
	
	// add in the links
	var link = svg.append("g").selectAll(".link")
					.data(graph.links)
					.enter().append("path")
					.attr("class", function(d){
						var source_name = d.real_source_name ? d.real_source_name : d.source.name;
						var target_name = d.real_target_name ? d.real_target_name : d.target.name;
						return "link " + source_name.replace(/ /g, "_") + " " + target_name.replace(/ /g, "_");
					})
					.attr("d", path)
					.style("stroke-width", function(d) { 
						return (d.dy); 
					})
					.sort(function(a, b) { return b.dy - a.dy; })
					.on("mouseover", function(d){
						showTip(this, param, d.source.name + " ↔ " + d.target.name + "<br>" + format(param, d.showValue, "yUnit"))
						if(param.eventCallback) param.eventCallback("mouseover", this);
				    })
				    .on("mouseout", function(d){
						hideTip();
						if(param.eventCallback) param.eventCallback("mouseout", this);
					});

	// add in the nodes
	var node = svg.append("g").selectAll(".node")
				  .data(graph.nodes)
				.enter().append("g")
				  .attr("class", "node")
				  .attr("transform", function(d) { 
					  return "translate(" + d.x + "," + d.y + ")"; })
				.call(d3.behavior.drag()
				  .origin(function(d) { return d; })
				  .on("dragstart", function() { 
					  this.parentNode.appendChild(this); })
				  .on("drag", dragmove));

 	var color = d3.scale.category10();

	// add the rectangles for the nodes
	node.append("rect")
		  .attr("class", function(d){
				return "rect " + d.name.replace(/ /g, "_");
			})
		  .attr("height", function(d) { 
				if (d.dy < 5) return 5;
				return d.dy; 
			})
		  .attr("width", sankey.nodeWidth())
		  .style("fill", function(d,i) { 
			  return d.color = color(i); })
		  .style("stroke", function(d) { 
			  return d3.rgb(d.color).darker(2); })
		  .on("mouseover", function(d){
			  showTip(this, param, d.name + "<br>" + format(param, d.showValue, "yUnit"))
			  if(param.eventCallback) param.eventCallback("mouseover", this);
		  })
		  .on("mouseout", function(d) {
			  hideTip();
 			  if(param.eventCallback) param.eventCallback("mouseout", this);
		  });

	// add in the title for the nodes
	node.append("text")
		  .attr("x", -6)
		  .attr("y", function(d) { return d.dy / 2; })
		  .attr("dy", ".35em")
		  .style("text-anchor", "end")
		  .attr("transform", null)
		  .text(function(d) { return d.name; })
		.filter(function(d) { return d.x < (width-padding.left-padding.right) / 2; })
		  .attr("x", 6 + sankey.nodeWidth())
		  .style("text-anchor", "start");

	// the function for moving the nodes
	function dragmove(d) {
		d3.select(this).attr("transform", 
			"translate(" + d.x + "," + (
					d.y = Math.max(0, Math.min((height-padding.top-padding.bottom) - d.dy, d3.event.y))
				) + ")");
		sankey.relayout();
		link.attr("d", path);
	  }
		
} // yableau.sankey()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__force = function(divId, svg, dataset, xField, yFields, param, title){
	var yField = yFields[0];
	var data   = multiDimTo1Dim(dataset);
	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];

	// data conversion.
	data.forEach(function(d){
		var a = d.x.split(' -> ');
		d.source = a[0];
		d.target = a[1];
		d.value  = d.y;
	})
	
	var units = param.units ? param.units : "Msg";
		
	// use log scale for small values.
	var vMax = d3.max(data, function(d){return d.value;});
	vScale = d3.scale.linear()
				.domain(param.yDomain ? param.yDomain : [1, vMax])
				.range([1, d3.min([width,height])/20]);
  
	//set up graph in same style as original example but empty
	var graph = {"nodes" : [], "links" : []};

	data.forEach(function (d) {
		graph.nodes.push({ "name": d.source });
		graph.nodes.push({ "name": d.target });
		graph.links.push({ "source": d.source,
							"target": d.target,
							"value": +d.value, 
							"sizeValue": vScale(d.value) 
						});
	});

	// return only the distinct / unique nodes
	graph.nodes = d3.keys(d3.nest()
					  .key(function (d) { return d.name; })
					  .map(graph.nodes));

	// loop through each link replacing the text with its index from node
	graph.links.forEach(function (d, i) {
		graph.links[i].source = graph.nodes.indexOf(graph.links[i].source);
		graph.links[i].target = graph.nodes.indexOf(graph.links[i].target);
	});

	//now loop through each nodes to make nodes an array of objects
	// rather than an array of strings
	graph.nodes.forEach(function (d, i) {
		graph.nodes[i] = { "name": d };
	});
	
	//Initialize a default force layout, using the nodes and links in graph
	var force = d3.layout.force()
						 .nodes(graph.nodes)
						 .links(graph.links)
						 .size([width, height])
						 .linkDistance([height/4])
						 .charge([-2000])
						 .start();

	graph.nodes.forEach(function(d){
		var value = 0;
		for (var i=0; i<data.length; i++){
			if (d.name == data[i].source || d.name == data[i].target){
				value += data[i].value;
			}
		}
		d.showValue = value;     // keep for display.
		d.sizeValue = vScale(value);
	});

	//Create links as lines
	var links = svg.selectAll("line")
		.data(graph.links)
		.enter()
		.append("line")
		.style("stroke", "#ccc")
		.style("stroke-width", function(d){
			return d3.max([1, d.sizeValue/2]);
		});
	
	//Create nodes as circles
	var nodes = svg.selectAll("circle")
		.data(graph.nodes)
		.enter()
		.append("circle")

	var texts = svg.selectAll("text")
		.data(graph.nodes)
		.enter()
		.append("text")
		.style("text-anchor", "middle")
		.text(function(d){
			return d.name;
		});

	//remove exit elements
	svg.selectAll("line")
		.data(graph.links)
		.exit()
		.transition()
		.duration(duration)
		.remove();

	svg.selectAll("circle")
		.data(graph.nodes)
		.exit()
		.transition()
		.duration(duration)
		.remove();

	svg.selectAll("text")
		.data(graph.nodes)
		.exit()
		.transition().duration(duration)
		.remove();		
		
	//re-config links as lines
	var links = svg.selectAll("line")
		.data(graph.links)
		//.transition().duration(duration)
		.style("stroke", "#ccc")
		.style("stroke-width", function(d){
			return d3.max([1, d.sizeValue/2]);
		});
	
	//re-config nodes as circles
	var nodes = svg.selectAll("circle")
		.data(graph.nodes)
		.attr("r", function(d,i){
			return d3.max([15, d.sizeValue]);
		})
		.style("fill", function(d, i) {
			return param.mouseoutColor[i];
		})
		.on("mouseover",function(d,i){
			showTip(this, param, "<b>" + d.name + "</b><br>" + format(param, d.showValue, "yUnit"));
			setTimeout(hideTip, 3000);
			d3.select(this)
				.style("fill", param.mouseoverColor[i]);
		})
		.on("mouseout",function(d,i){
			hideTip();
			d3.select(this)
				.style("fill", param.mouseoutColor[i]);
		})
		.call(force.drag)
		//.transition().duration(duration)
		.style("opacity", 0.7);

	// re-config texts
	var texts = svg.selectAll("text")
		.data(graph.nodes)
		.style("text-anchor", "middle")
		//.transition().duration(duration)
		.text(function(d){
			return d.name;
		});
		
	//Every time the simulation "ticks", this will be called
	force.on("tick", function() {

		links.attr("x1", function(d) { return d.source.x; })
			 .attr("y1", function(d) { return d.source.y; })
			 .attr("x2", function(d) { return d.target.x; })
			 .attr("y2", function(d) { return d.target.y; });
	
		nodes.attr("cx", function(d) { return d.x; })
			 .attr("cy", function(d) { return d.y; });

		texts.attr("x", function(d) { return d.x; })
			 .attr("y", function(d) { return d.y+5; });

	});

} // yableau.force()
//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__bubble = function(divId, svg, dataset, xField, yFields, param, title){
	var padding = clone(param.padding); // clone it for internal re-config.
	var width = param.width[divId], height = param.height[divId];
	var dataset = multiDimTo1Dim(dataset);

	var layout = d3.layout.pack()
	    	.size([ width, height])
	    	.sort(function(a,b){
				return b.y - a.y;
			})
	    	.value(function(d){
				var i = param.xFieldSeq[divId][d.x];
				d.name = d.x;
				d.weight = d.y;
				d.color = param.mouseoutColor[i];
				d.mouseoverColor = param.mouseoverColor[i];
	    		return d.weight;
	    	})
		.padding(2);
	var root = {children: dataset};
	var nodes = layout.nodes(root);
	
	var bbls = svg.selectAll(".bubble")
				  .data(nodes.filter(function(d) { 
					  return !d.children; 
				  }));
		
	bbls.enter()
		.append("g")
		.attr("class","bubble")
		.each (function(d) {
			d3.select(this).append("circle");
			d3.select(this).append("text").attr("class", "text1");
			d3.select(this).append("text").attr("class", "text2");
		});
	bbls.exit().remove();

	var fIdx = getFilterById(divId, param.filters);
	bbls.each(function(d){
		d3.select(this)
			.transition().duration(duration)
			.style("opacity", d.r ? (filterIn(divId, param, d.name)==1 ? 1 : (fIdx>=0 ? 0.5 : 1)) : 0 );
			
		d3.select(this).select("circle")
			.on("mouseover",function(d){
				showTip(this, param, "<b>" + d.name + "</b><br>" + format(param, d.weight, "yUnit"));
				if (filterIn(divId, param, d.name)==1) return;
				d3.select(this).style("fill", d.mouseoverColor);
			})
			.on("mouseout",function(d){
				hideTip();
				if (filterIn(divId, param, d.name)==1) return;
				d3.select(this).style("fill", d.color);
			})
			.on("click", function(d){
				doFilter(divId, param, xField, d.name);
			})
			.on("dblclick", function(d){
				console.log(this);
			})
			.transition().duration(duration)
			.style("fill", d.color)
			.attr("cx", d.x)
			.attr("cy", d.y)
			.attr("r", d.r)

		d3.select(this).select("text.text1")
			.transition().duration(duration)
			.attr("text-anchor", "middle")
			.attr("x", d.x)
			.attr("y", d.y - 3)
			.text(d.name);
			
		d3.select(this).select("text.text2")
			.transition().duration(duration)
			.attr("text-anchor", "middle")
			.attr("x", d.x)
			.attr("y", d.y + 10)
			.text("(" + d.weight + ")");
		
	})
	
} // yableau.bubble()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
yableau.__table = function(divId, svg, dataset, xField, yFields, param, title){
	var origData = param.filters.cb[divId].origData;
	var data = [];
	
	for (var i=0; i<origData.length; i++){
		var match = true;
		for (var f=0; f<param.filters.f.length; f++) {
			if ( !param.filters.f[f].values [   origData[i][param.filters.f[f].xField]   ] ) {
				match = false;
				break;
			}
		}
		if (match) data.push(origData[i]);
		if (param.maxRows && data.length >= param.maxRows) break;
		if (data.length >= 1000) break;
	}
		
	var header = [];
	if (yFields instanceof Array && yFields[0]){
		yFields.forEach(function(d){
			var str = d.replace(/^sum of /, "").replace(/^count of /, "").replace(/^average of /, "");
			header.push({data: str, title: str});
		});
	}else{
		d3.keys(origData[0]).forEach(function(d){
			if (!d.match(/^sum of /) && !d.match(/^count of /) && !d.match(/^average of /)){
				header.push({data: d, title: d});
			}
		});
	}
	
	var config  = param.config ? clone(param.config) : {};
	
	config.data = data;
	config.columns = header;
	config.destroy = true;
	
	$(divId + " table").DataTable(config);
	
} // yableau.table()

//------------------------------------------------------------------------------------------
function postAction(divId, param){
    if (!param.filters || !param.filters.postAction || !param.filters.f) return;
    var selVals = [];
    param.filters.f.forEach(function(d){
        d3.keys(d.values).forEach(function(value){
            if (d.values[value]) {
                selVals.push(value);
            }
        });
    });
    param.filters.postAction(divId, selVals);
}
//------------------------------------------------------------------------------------------
var __redraw = function(divId, param){
	//console.log(divId)
	//console.log(new Date().getTime());
	var p = param.filters.cb[divId];
	var dataset = buildDataSets(divId, p.origData, p.xField, p.yFields, param);

	//console.log(new Date().getTime());
	yableau['__' + p.gType](divId, p.svg, dataset, p.xField, p.yFields, param, p.title);
	//console.log(new Date().getTime());
	
	drawIcons(p.gType, divId, p.svg, p.yFields, param);

	postAction(divId, param); // for some post actions.
}

var yableau_draw = function(gType, divId, origData, xField, valuesAndLegend, param, title){
    if (!title) title="";
	var rc = handleValuesAndLegend(origData, valuesAndLegend, param);
	//rc = {yFields: new_y, legend: y.legend, leKeys: le};
		
	var param  = getSetAttr(divId, param);
	var svg = initSvg(gType, divId, origData, xField, rc, param, title);
	
	// for icon display & color
	if (!param.shows) param.shows = new Object;
	param.shows[divId] = [];
	rc.yFields.forEach(function(d,i){
		param.shows[divId].push({data:1, on:1});
	});
	
	dataset = buildDataSets(divId, origData, xField, rc.yFields, param);	

	//if (xField && rc.yFields[0]) {
	// for xField display & color
	if (!param.xFieldSeq) param.xFieldSeq = new Object;
	param.xFieldSeq[divId] = {};
	if (dataset[0]) {
		dataset[0].forEach(function(d,i){
			param.xFieldSeq[divId][d.x] = i;
		});
	}
	
	yableau['__' + gType](divId, svg, dataset, xField, rc.yFields, param, title);
		
	drawIcons(gType, divId, svg, rc.yFields, param);

	postAction(divId, param); // for some post actions.
}

yableau.bar    = function(){yableau_draw('bar',    arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.column = function(){yableau_draw('column', arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.area   = function(){yableau_draw('area',   arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.curve  = function(){yableau_draw('curve',  arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.pie    = function(){yableau_draw('pie',    arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.map    = function(){yableau_draw('map',    arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.sankey = function(){yableau_draw('sankey', arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.force  = function(){yableau_draw('force',  arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.bubble = function(){yableau_draw('bubble', arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}
yableau.table  = function(){yableau_draw('table',  arguments[0],arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);}

//------------------------------------------------------------------------------------------

return yableau;
}();

