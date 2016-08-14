yableau = function() {
	
var yableau = {version: "1.0.0"};
var color = d3.scale.category20();
var yabPadding = {top:30, left: 50, right: 20, bottom: 20};

console.log("yableau init.");

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
		.attr("class", "bar");
		
	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.rects")
		.selectAll("rect.bar")
		.data(dataset)
		.attr("x",padding.left)
		.attr("y",function(d, i) {
				return yScale(i);
		})
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
		.transition()
		.duration(2000)
		.attr("width",function(d, i) {
			return xScale(d.y) - xScale(0);
		});
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.enter()
		.append("text")
		.attr("class", "bar")
		.attr("x", xScale(0)+20);

	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.text(function(d) {
			return d.y;
		})
		.attr("text-anchor", "end")
		.attr("y", function(d,i) {
			return yScale(i)+yScale.rangeBand()/2+5;
		})
		.transition()
		.duration(2000)
		.attr("x", function(d, i) {
			var x = xScale(d.y);
			return x + (x < width/2 ? 20 : -25);
		})
		.attr("fill", function(d, i) {
			return xScale(d.y) < width/2 ? "#444" : "#fff";
		});
		
	//Create X axis
	svg.select("g.xAxis")
		.attr("transform", "translate(0, " + padding.top + ")")
		.call(xAxis);

	//Create Y axis
	svg.select("g.yAxis")
		.attr("transform", "translate(" + padding.left + ",0)")
		.call(yAxis)
		.selectAll("text")
		.text(function(d,i){
			return dataset[i].x;
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
		.attr("x",function(d, i) {
				return xScale(i);
		})
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
		.transition()
		.duration(2000)
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
		.attr("class", "bar");

	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.exit()
		.remove();
		
	svg.select("g.texts")
		.selectAll("text.bar")
		.data(dataset)
		.text(function(d) {
			return d.y;
		})
		.attr("text-anchor", "middle")
		.attr("x", function(d,i) {
			return xScale(i)+xScale.rangeBand()/2+5;
		})
		.attr("y", function(d,i){
			if (!d3.select(this).attr("y")) return yScale(0);
			return yScale(d.y);
		})
		.transition()
		.duration(2000)
		.attr("y", function(d) {
			return yScale(d.y);
		})
		
	//Create Y axis
	svg.select("g.yAxis")
		.attr("transform", "translate(" + padding.left + ",0)")
		.call(yAxis);

	//Create X axis
	svg.select("g.xAxis")
		.attr("transform", "translate(0, " + (height - padding.bottom) + ")")
		.call(xAxis)
		.selectAll("g.xAxis text")
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
		.transition()
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
		.attr("x",function(d){
			//return d.properties.position[0];
			return projection([d.properties.cp[0], d.properties.cp[1]])[0];
		})
		.attr("y",function(d){
			//return d.properties.position[1];
			return projection([d.properties.cp[0], d.properties.cp[1]])[1];
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
	var outerRadius = width / 2 - 30;
	var innerRadius = width / 4 - 30;

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

		svg.append("g")
			.attr("class", "paths")
			.attr("transform","translate(" + (outerRadius+30) + "," + (outerRadius+30) + ")");
		svg.append("g")
			.attr("class", "texts")
			.attr("transform","translate(" + (outerRadius+30) + "," + (outerRadius+30) + ")");
			
	}
	
	//dataset.push({x:"noname", y:1});
		
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
		
	var gPath = svg.select("g.paths");
	gPath.selectAll("path")
		.data(ddd)
		.enter()
		.append("path");
	
	gPath.selectAll("path")
		.data(ddd)
		.attr("d",function(d, i){
			console.log(i);
			return arc(d);
		})
		.attr("fill",function(d,i){
			return color(i);
		})
	.each(function(d,i){
		var fIdx = getFilterById(divId, param.filters);
		if (fIdx >= 0 && param.filters[fIdx].value == d.label) {
			d3.select(this).attr({'fill': attr.mouseoverColor, 'stroke-width': 1, 'stroke': "#444"});
			d3.select(this)
				.transition()
				.attr("transform","translate(" + Math.sin((d.startAngle+d.endAngle)/2)*20 + "," 
											   + Math.cos((d.startAngle+d.endAngle)/2)*(-20) + ")");
		}else{
			d3.select(this).attr({'fill': color(i), 'stroke-width': 1, 'stroke': "#ddd"});
			d3.select(this)
				//.transition()
				.attr("transform","translate(" + 0 + "," + 0 + ")");
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
			.attr("fill", color(i));
	})
	.on("click", function(d,i){
		doFilter(this, divId, param, origData, xField, d.label);
	});
	
	gPath.selectAll("path")
		.data(ddd)
		.exit()
		.remove();

	var gText = svg.select("g.texts");
	gText.selectAll("text")
		.data(ddd)
		.enter()
		.append("text");
	
	gText.selectAll("text")
		.data(ddd)
		.attr("transform",function(d){
			return "translate(" + arc.centroid(d) + ")";
		})
		.attr("text-anchor","middle")
		.text(function(d, i){
			return d.label + " " + d.value;
		});
	gText.selectAll("text")
		.data(ddd)
		.exit()
		.remove();
} // yableau.column()

//------------------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------


//------------------------------------------------------------------------------------------

return yableau;
}();

