yableau = function() {
	
var yableau = {version: "1.0.0"};
var color = d3.scale.category20();
var duration = 250;
var yabPadding = {top:30, left: 50, right: 20, bottom: 20};

console.log("yableau init.");

var formatNumber = d3.format(",.0f"),    // zero decimal places
	format = function(d) { return formatNumber(d); };
		
function getFilterById(divId, filters){
	for (var i=0; i<filters.length; i++) {
		if (filters[i].divId == divId) return i;
	}
	return -1;
}
function doFilter(domId, divId, param, origData, xField, value) {
	var fIdx = getFilterById(divId, param.filters)
	if (fIdx >= 0) {
		if (param.filters[fIdx].value == value) {
			param.filters.splice(fIdx,1); // remove this filter.
			param.callback(origData);  // redraw every chart.
		}
	}else{
		param.filters.push({divId: divId, xField: xField, value: value});
		param.callback(origData);
	}
}


function showTip(o, c){
	var oRect = o.getBoundingClientRect();
    x = document.body.scrollLeft + (oRect.left + oRect.width /2);
    y = document.body.scrollTop  + (oRect.top  + oRect.height/2);

	//Update the tooltip position and content
	d3.select("#tooltip")
		.style("left", x + "px")
		.style("top", y + "px")						
		.select("#title")
		.html(c);

	//Show the tooltip
	d3.select("#tooltip").classed("hidden", false);
}

function hideTip(){
	//Hide the tooltip
	d3.select("#tooltip").classed("hidden", true);
}
					
//------------------------------------------------------------------------------------------
function buildData(divId, origData, xField, yField, param){
	var dataset=[];
	/*
		x, total
		a, 1
		a, 2
		a, 3
		b, 4
		b, 6
	==>
		[{x:a,v:6}, {x:b, v10}]
	*/
	for (var i=0; i<origData.length; i++){
		/* 
		   param.filters = [{divId: ?, xField: ? value: ?}, {}, {}] 
		*/

		var fIdx = getFilterById(divId, param.filters);
		if (fIdx < 0) fIdx = param.filters.length; // if no own filter found, use all filters.
		var match = true;
		for (var f=0; f<fIdx; f++) {
			if (origData[i][param.filters[f].xField] != param.filters[f].value) {
				match = false;
				break;
			}
		}
		if (match == false) continue; 

		// accumulate key->val pair.
		var key =  origData[i][xField];
		var val = +origData[i][yField]; 
		
		if (key == undefined || isNaN(val)) continue;
		
		var found = 0;
		for (var k=0; k<dataset.length; k++) {
			if (dataset[k].x == key) {
				dataset[k].y += val;
				found = 1;
				break;
			}
		}
		if (found == 0){ // a new data row.
			dataset.push({x:key, y:val})
		}
	}
	
	if (param.sortType){
		if (param.sortType == "a") {
			dataset.sort(function(a,b){
				return a.y - b.y;
			});
		}else if (param.sortType == "d") {
			dataset.sort(function(a,b){
				return b.y - a.y;
			});
		}
	}

	return dataset;
}

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
console.log("define yableau.bar");

yableau.bar = function(divId, origData, xField, yField, param, attr){

	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));
	
	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : yabPadding;
	
	if (!attr.mouseoverColor) attr.mouseoverColor = "#7BCCB5";
	if (!attr.mouseoutColor)  attr.mouseoutColor  = "#2B65EC";
	
	var dataset=buildData(divId, origData, xField, yField, param);
	
	// data is ready, now draw.
	var svg = d3.select(divId).select("svg");
	if (!d3.select(divId).attr("svg")) {
		d3.select(divId).attr("svg", "yes");
		svg = d3.select(divId)
				.append("svg")
				.attr("width", width)
				.attr("height", height);

		svg.append("rect")
			.attr("class", "bgRect")
			.attr("x",0)
			.attr("y",0)
			.attr("width",width)
			.attr("height",height)
			.style("fill","#FFF")
			.style("stroke-width",2)
			.style("stroke","#ccc");
			
		svg.append("g").attr("class", "rects");
		svg.append("g").attr("class", "texts");
		svg.append("g").attr("class", "xAxis");
		svg.append("g").attr("class", "yAxis");
	}
	
	var vMax = d3.max(dataset, function(d){return d.y;});

//	console.log(String(vMax).length);
	var tickNbr = (width - padding.left)/11*1.414; 
//	console.log(tickNbr);
	
	// setup X scale
	xScale = d3.scale.linear()
		.domain([0, vMax])
		.range([padding.left, width - padding.right]);

	//Define X axis
	xAxis = d3.svg.axis()
			  .scale(xScale)
			  .orient("top")
			  .ticks(1); // tick counts.

	// setup Y scale
	yScale = d3.scale.ordinal()
			.domain(d3.range(dataset.length))
			.rangeRoundBands([padding.top, height - padding.bottom], 0.25); //0.25=ratio of blank / bar.

	//Define Y axis
	yAxis = d3.svg.axis()
			.scale(yScale)
			.orient("left");

	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.enter()
		.append("rect")
		.attr("class", "bar")
		.attr("x",padding.left)
		.attr("y",function(d, i) {
				return yScale(i);
		});
		
	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.each(function(d,i){
			var fIdx = getFilterById(divId, param.filters);
			if (fIdx >= 0 && param.filters[fIdx].value == d.x) {
				d3.select(this).attr({'fill': attr.mouseoverColor, 'stroke-width': 3, 'stroke': "#000"});
			}else{
				d3.select(this).attr({'fill': attr.mouseoutColor,  'stroke-width': 1, 'stroke': "#ddd"});
			}
		})
		.on("mouseover",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", attr.mouseoverColor);
		})
		.on("mouseout",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", attr.mouseoutColor);
		})
		.on("click", function(d,i){
			doFilter(this, divId, param, origData, xField, d.x);
		})
		.attr("height",function(d, i) {
			return yScale.rangeBand();
		})
		.transition().duration(duration)
		.attr("x",padding.left)
		.attr("y",function(d, i) {
				return yScale(i);
		})		.attr("width",function(d, i) {
			return xScale(d.y) - xScale(0);
		});
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.enter()
		.append("text")
		.attr("class", "bar")
		.attr("x", xScale(0)+20)
		.attr("y", function(d,i) {
			return yScale(i)+yScale.rangeBand()/2+5;
		})

	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.text(function(d) {
			return format(d.y);
		})
		.transition().duration(duration)
		.attr("y", function(d,i) {
			return yScale(i)+yScale.rangeBand()/2+5;
		})
		.attr("x", function(d, i) {
			var x = xScale(d.y);
			if (x<width/2){
				d3.select(this).attr("text-anchor", "start");
				x = x + 5;
			}else{
				d3.select(this).attr("text-anchor", "end");
				x = x - 5;
			}
			return x;
		})
		.attr("fill", function(d, i) {
			return xScale(d.y) < width/2 ? "#444" : "#fff";
		});
		
	//Create X axis
	svg.select("g.xAxis")
		.attr("transform", "translate(0, " + padding.top + ")")
		.transition().duration(duration)
		.call(xAxis);

	//Create Y axis
	svg.select("g.yAxis")
		.attr("transform", "translate(" + padding.left + ",0)")
		.transition().duration(duration)
		.call(yAxis);
	svg.select("g.yAxis")
		.selectAll("text")
		.data(dataset)
		.transition().duration(duration)
		.text(function(d,i){
			return d.x;
		});
		
} // yableau.bar()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
console.log("define yableau.column");

yableau.column = function(divId, origData, xField, yField, param, attr){

	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));
	
	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : yabPadding;
	
	if (!attr.mouseoverColor) attr.mouseoverColor = "red";
	if (!attr.mouseoutColor)  attr.mouseoutColor  = "#E4287C";
	
	var dataset=buildData(divId, origData, xField, yField, param);
	
	
	// data is ready, now draw.
	var svg = d3.select(divId).select("svg");
	if (!d3.select(divId).attr("svg")) {
		d3.select(divId).attr("svg", "yes");
		svg = d3.select(divId)
				.append("svg")
				.attr("width", width)
				.attr("height", height);

		svg.append("rect")
			.attr("class", "bgRect")
			.attr("x",0)
			.attr("y",0)
			.attr("width",width)
			.attr("height",height)
			.style("fill","#FFF")
			.style("stroke-width",2)
			.style("stroke","#ccc");
			
		svg.append("g").attr("class", "rects");
		svg.append("g").attr("class", "texts");
		svg.append("g").attr("class", "yAxis");
		svg.append("g").attr("class", "xAxis");
	}
	
	var vMax = d3.max(dataset, function(d){return d.y;});
	
	// setup X scale
	xScale = d3.scale.ordinal()
			.domain(d3.range(dataset.length))
			.rangeRoundBands([padding.left, height - padding.right], 0.25); //0.25=ratio of blank / bar.

	//Define X axis
	xAxis = d3.svg.axis()
			.scale(xScale)
			.orient("bottom");

	// setup Y scale
	yScale = d3.scale.linear()
		.domain([0, vMax])
		.range([height - padding.bottom, padding.top]);

	//Define Y axis
	yAxis = d3.svg.axis()
			  .scale(yScale)
			  .orient("left")
			  .ticks(3); // tick counts.


	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.enter()
		.append("rect")
		.attr("class", "bar")
		.attr("x",function(d, i) {
				return xScale(i);
		})
		.attr("y", yScale(0))
		.attr("height", 0);
		
	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.each(function(d){
			var fIdx = getFilterById(divId, param.filters);
			if (fIdx >= 0 && param.filters[fIdx].value == d.x) {
				d3.select(this).attr({'fill': attr.mouseoverColor, 'stroke-width': 3, 'stroke': "#000"});
			}else{
				d3.select(this).attr({'fill': attr.mouseoutColor,  'stroke-width': 1, 'stroke': "#ddd"});
			}
		})
		.on("mouseover",function(d){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", attr.mouseoverColor);
		})
		.on("mouseout",function(d){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", attr.mouseoutColor);
		})
		.on("click", function(d){
			doFilter(this, divId, param, origData, xField, d.x);
		})
		.attr("width",function(d) {
			return xScale.rangeBand();
		})
		.transition().duration(duration)
		.attr("x",function(d, i) {
				return xScale(i);
		})
		.attr("y", function(d) {
			return yScale(d.y);
		})
		.attr("height",function(d) {
			return yScale(0) - yScale(d.y);
		});
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.enter()
		.append("text")
		.attr("class", "bar")
		.attr("x", function(d,i) {
			return xScale(i)+xScale.rangeBand()/2+5;
		})
		.attr("y", function(d,i){
			return yScale(0);
		});

	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.text(function(d) {
			return format(d.y);
		})
		.attr("text-anchor", "middle")
		.transition().duration(duration)
		.attr("x", function(d,i) {
			return xScale(i)+xScale.rangeBand()/2+5;
		})
		.attr("y", function(d) {
			return yScale(d.y);
		})
		
	//Create Y axis
	svg.select("g.yAxis")
		.attr("transform", "translate(" + padding.left + ",0)")
		.transition().duration(duration)
		.call(yAxis);

	//Create X axis
	svg.select("g.xAxis")
		.attr("transform", "translate(0, " + (height - padding.bottom) + ")")
		.transition().duration(duration)
		.call(xAxis);
	svg.selectAll("g.xAxis text")
		.data(dataset)
		.transition().duration(duration)
		.text(function(d,i){
			return dataset[i].x;
		});
		
} // yableau.column()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
console.log("define yableau.map");

yableau.map = function(divId, origData, xField, yField, param, attr){
	
	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));

	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : yabPadding;
	
	if (!attr.mouseoverColor) attr.mouseoverColor = "orange";
	if (!attr.mouseoutColor)  attr.mouseoutColor  = "yellow";

	var dataset=buildData(divId, origData, xField, yField, param);
	
	var vMax = d3.max(dataset, function(d){return d.y;});
	if (vMax < 1) vMax = 1;  // avoid 0 & negative error.
	
	var svg = d3.select(divId).select("svg");
	if (!d3.select(divId).attr("svg")) {
		d3.select(divId).attr("svg", "yes");
		svg = d3.select(divId).append("svg")
				.attr("width", width)
				.attr("height", height)
				.append("g")
				.attr("transform", "translate(0,0)");

		svg.append("rect")
				.attr("x",0)
				.attr("y",0)
				.attr("width",width)
				.attr("height",height)
				.style("fill","#FFF")
				.style("stroke-width",2)
				.style("stroke","#ccc");
				
		var container = svg.append("g").attr("class", "container");
		container.append("g").attr("class", "paths");
		container.append("g").attr("class", "circles");
		container.append("g").attr("class", "texts");
	}
	
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
		
	container.select("g.paths")
		.selectAll("path")
		.data(features)
		.enter()
		.append("path");
		
	container.select("g.paths")
		.selectAll("path")
		.data(features)
		.exit()
		.remove();
	
	container.select("g.paths")
		.selectAll("path")
		.data(features)
		.attr("stroke","#000")
		.attr("stroke-width",1)
		.attr("fill", function(d,i){
			return "rgb(245,243,240)";
		})
		.attr("d", path)
		.each(function(d,i){
			d.properties.position = path.centroid(d);
		})
		.on("mouseover",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill","#ddd");
		})
		.on("mouseout",function(d,i){
			d3.select(this)
				.attr("fill", "rgb(245,243,240)");
		});
		
		
	// put value circles.
	container.select("g.circles")
		.selectAll("circle")
		.data(features)
		.enter()
		.append("circle");
		
	container.select("g.circles")
		.selectAll("circle")
		.data(features)
		.exit()
		.remove();

	container.select("g.circles")
		.selectAll("circle")
		.data(features)
		.attr("class", "in_map")
		.attr("cx", function(d) {
			return projection([d.properties.cp[0], d.properties.cp[1]])[0];
		})
		.attr("cy", function(d) {
			return projection([d.properties.cp[0], d.properties.cp[1]])[1];
		})
		.each(function(d,i){
			var fIdx = getFilterById(divId, param.filters);
			if (fIdx >= 0 && param.filters[fIdx].value == d.properties.name) {
				d3.select(this).attr({'fill': attr.mouseoverColor, 'stroke-width': 3, 'stroke': "#000"});
			}else{
				d3.select(this).attr({'fill': attr.mouseoutColor, 'stroke-width': 1, 'stroke': "#ddd"});
			}
		})
		.on("mouseover",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", attr.mouseoverColor);
		})
		.on("mouseout",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", attr.mouseoutColor);
		})
		.on("click", function(d,i){
			doFilter(this, divId, param, origData, xField, d.properties.name);
		})
		.transition().duration(duration)
		.attr("r", function(d) {
			var y = 0;
			dataset.forEach(function(c,i){
				if (c.x == d.properties.name) y = c.y;
			});
			return Math.sqrt(Math.abs(y / vMax * 700));
		});

	
	// put text on top.
	container.select("g.texts")
		.selectAll("text")
		.data(features)
		.enter()
		.append("text");

	container.select("g.texts")
		.selectAll("text")
		.data(features)
		.exit()
		.remove();
		
	container.select("g.texts")
		.selectAll("text")
		.data(features)
		.text(function(d,i){return d.properties.name;})
		.attr("text-anchor", "middle")
		.attr("x",function(d){
			//return d.properties.position[0];
			return projection([d.properties.cp[0], d.properties.cp[1]])[0];
		})
		.attr("y",function(d){
			//return d.properties.position[1];
			return projection([d.properties.cp[0], d.properties.cp[1]])[1]+5;
		});

	function zoomed() {
		container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	}
} // yableau.map()


//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
console.log("define yableau.pie");

yableau.pie = function(divId, origData, xField, yField, param, attr){

	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));
	
	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : yabPadding;
	
	if (!attr.mouseoverColor) attr.mouseoverColor = "blue";
	if (!attr.mouseoutColor)  attr.mouseoutColor  = "green";
	
	var dataset=buildData(divId, origData, xField, yField, param);
	
	// data is ready, now draw.
	var outerRadius = d3.min([width, height]) / 2 - 30;
	var innerRadius = d3.min([width, height]) / 4 - 30;

	var svg = d3.select(divId).select("svg");
	if (!d3.select(divId).attr("svg")) {
		d3.select(divId).attr("svg", "yes");
		svg = d3.select(divId)
				.append("svg")
				.attr("width", width)
				.attr("height", height);

		svg.append("rect")
			.attr("class", "bgRect")
			.attr("x",0)
			.attr("y",0)
			.attr("width",width)
			.attr("height",height)
			.style("fill","#FFF")
			.style("stroke-width",2)
			.style("stroke","#ccc");
	}
			
	var pie = d3.layout.pie();
		
	var data = [];
	dataset.forEach(function(d){
		data.push(d.y);
	});
	
	var ddd = pie(data);
	for(var i=0; i<data.length; i++){
		ddd[i].label = dataset[i].x;
		ddd[i].color = color(i);
	}	
	
	var arc = d3.svg.arc()
					.innerRadius(innerRadius)
					.outerRadius(outerRadius);

	var arcs = svg.selectAll("g")
					.data(ddd)
					.enter()
					.append("g")
					.attr("transform","translate(" + (outerRadius+30) + "," + (outerRadius+30) + ")");
					
	arcs.append("path");
	arcs.append("text");
	
	svg.selectAll("g")
		.data(ddd)
		.each(function(d,i){
			d3.select(this)
				.select("path")
				//.transition().duration(duration) // Errors to be fixed.
				.attr("d", arc(d))
				.attr("fill", color(i));
			d3.select(this)
				.select("text")
				.attr("transform", "translate(" + arc.centroid(d) + ")")
				.attr("text-anchor","middle")
				.text(function(){
					if (d.endAngle - d.startAngle < 3.1416/12) return ""; // less than 15deg, show nothing.
					return d.label + " " + format(d.value);
				});
			
			var fIdx = getFilterById(divId, param.filters);
			if (fIdx >= 0 && param.filters[fIdx].value == d.label) {
				d3.select(this)
					.select("path")
					.attr({'fill': attr.mouseoverColor, 'stroke-width': 1, 'stroke': "#444"});
				d3.select(this)
					.transition().duration(duration)
					.attr("transform","translate(" + (outerRadius+30+Math.sin((d.startAngle+d.endAngle)/2)*20) + "," 
												   + (outerRadius+30+Math.cos((d.startAngle+d.endAngle)/2)*(-20)) + ")");
			}else{
				d3.select(this)
					.select("path")
					.attr({'fill': color(i), 'stroke-width': 1, 'stroke': "#ddd"});
				d3.select(this)
					.transition().duration(duration)
					.attr("transform","translate(" + (outerRadius+30) + "," + (outerRadius+30) + ")");
			}
		})
		.on("mouseover",function(d,i){
			showTip(this, "<b>" + d.label + "</b><br>" + format(d.value));
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this).select("path")
				.attr("fill", attr.mouseoverColor);
		})
		.on("mouseout",function(d,i){
			hideTip();
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this).select("path")
				.attr("fill", color(i));
		})
		.on("click", function(d,i){
			doFilter(this, divId, param, origData, xField, d.label);
		});
	
	svg.selectAll("g")
		.data(ddd)
		.exit()
		.remove();
		
} // yableau.pie()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------
console.log("define yableau.sankey");

yableau.sankey = function(divId, origData, xField, yField, param, attr){

	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));
	
	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : yabPadding;
	
	if (!attr.mouseoverColor) attr.mouseoverColor = "blue";
	if (!attr.mouseoutColor)  attr.mouseoutColor  = "green";
	
	// filter data.
	var newData = [];
	for(var i=0; i<origData.length; i++) {
		var fIdx = param.filters.length; // if no own filter found, use all filters.
		var match = true;
		for (var f=0; f<fIdx; f++) {
			if (origData[i][param.filters[f].xField] != param.filters[f].value) {
				match = false;
				break;
			}
		}
		if (match == false) continue; 
		newData.push(origData[i]);
	}

	// data conversion.
	var data = [];
	xField.forEach(function(d){  // xField is from-to pairs
		var source = d.from;
		var target = d.to;
		
		newData.forEach(function(d2){
			var value  = +d2[yField];
			for (var i=0; i<data.length; i++) {
				if (data[i].source == d2[source] && data[i].target == d2[target]){
					data[i].value += value;
					//console.log(i + ": " + data[i].value);
					return;
				}
			}
			data.push({source: d2[source], target: d2[target], value: value});
		});
	});	
	//console.log(data);


	
	//**********************************************************************
	// unfortunately their are often dead loops, which cause browers dead!. 
	// To avoid them, I have to level sources and destinations.
	//**********************************************************************

	var nodes = []; // nodes = [{name: "name", children: []}, {}, {}]
	for (var i=0; i<data.length; i++) {
		//console.log(i);
		var d = seekInNodes(nodes, data[i].source);
		if (d == undefined){
			var child = {name: data[i].target, value: data[i].value, children: []};
			nodes.push({name: data[i].source, children: [child]});
		}else{
			var found = 0;
			for (var k=0; k<d.children.length; k++){
				if(d.children[k].name == data[i].target){
					d.children[k].value += +data[i].value;
					found = 1;
				}
			}
			if (found == 0){
				var child = {name: data[i].target, value: data[i].value, children: []};
				d.children.push(child);
			}
		}
	}
	
	function seekInNodes(nodesToSeek, name){
		for (var i=0; i<nodesToSeek.length; i++){
			if (nodesToSeek[i].name == name) {
				return nodesToSeek[i];
			}
		}
		for (var i=0; i<nodesToSeek.length; i++){
			var r = seekInNodes(nodesToSeek[i].children, name);
			if (r) return r;
		}
		return undefined;
	}
	
	//console.log(nodes);
	
	var level = 1;
	newData = [];
	nodes.forEach(function(node){
		popNewData(node, level);
	});
	function popNewData(node, level) {
		node.children.forEach(function(child){
			var v = {source: (node.name + "_" + level), target: (child.name + "_" + (level+1)), value: child.value};
			if (isNaN(child.value)) {
				console.log(v);
			}else{
				newData.push(v);
			}
			popNewData(child, level+1);
		});
	}
	
	//console.log(newData);

	//**********************************************************************
	// DONE!
	//**********************************************************************
		
	data = newData;
	var vMax = d3.max(data, function(d){return d.value;});

	// use log scale for small values.
	vScale = d3.scale.log()
				.domain([1, vMax])
				.range([1, height/3]);
	data.forEach(function(d){
		d.showValue = d.value;     // keep for display.
		d.value = vScale(d.value);
	});
	

		
	d3.select(divId).select("svg").remove();  // delete and redraw.


	//-------------------------------------------------------------------------
	var units = attr.units ? attr.units : "Msg";

	var formatNumber = d3.format(",.0f"),    // zero decimal places
		format = function(d) { return formatNumber(d) + " " + units; },
		color = d3.scale.category20();

	// append the svg canvas to the page
	var svg = d3.select(divId).append("svg")
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

	// add in the links
	var link = svg.append("g").selectAll(".link")
					.data(graph.links)
					.enter().append("path")
					.attr("class", "link")
					.attr("d", path)
					.style("stroke-width", function(d) { return Math.max(1, d.dy); })
					.sort(function(a, b) { return b.dy - a.dy; })
					.on("mouseover", function(d){
					  showTip(this, d.source.name + " → " + d.target.name + "<br>" + format(d.showValue))
				    })
				    .on("mouseout", hideTip);

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

	// add the rectangles for the nodes
	node.append("rect")
		  .attr("height", function(d) { 
				if (d.dy < 0){
					console.log(d);
				}
				if (d.dy < 5) return 5;
				return d.dy; 
			})
		  .attr("width", sankey.nodeWidth())
		  .style("fill", function(d) { 
			  return d.color = color(d.name.replace(/ .*/, "")); })
		  .style("stroke", function(d) { 
			  return d3.rgb(d.color).darker(2); })
		  .on("mouseover", function(d){
			  showTip(this, d.name + "<br>" + format(d.showValue))
		  })
		  .on("mouseout", hideTip);

	// add in the title for the nodes
	node.append("text")
		  .attr("x", -6)
		  .attr("y", function(d) { return d.dy / 2; })
		  .attr("dy", ".35em")
		  .attr("text-anchor", "end")
		  .attr("transform", null)
		  .text(function(d) { return d.name; })
		.filter(function(d) { return d.x < (width-padding.left-padding.right) / 2; })
		  .attr("x", 6 + sankey.nodeWidth())
		  .attr("text-anchor", "start");

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

return yableau;
}();

