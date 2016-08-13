yableau = function() {
	
var yableau = {version: "1.0.0"};
var color = d3.scale.category20();

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
//			d3.select(domId)
//				.style("stroke", "#000")
//				.style("stroke-width", 0);
			param.filters.splice(fIdx,1); // remove this filter.
			param.callback(origData);  // redraw every chart.
		}
	}else{
//		d3.select(domId)
//			.style("stroke", "#000")
//			.style("stroke-width", 3);
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
		var key = origData[i][xField];
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
	
	if (param.sortBy) {
		for (var i=0; i<dataset.length-1; i++){
			for (var k=i+1; k<dataset.length; k++){
				var exchange = false;
				if (param.sortBy == "A"){
					if (dataset[i].y > dataset[k].y) exchange = true;
				}else{
					if (dataset[i].y < dataset[k].y) exchange = true;
				}
				if (exchange){
					var tmp = dataset[i];
					dataset[i] = dataset[k];
					dataset[k] = tmp;
				}
			}
		}
	}

	return dataset;
}	
//------------------------------------------------------------------------------------------
console.log("define yableau.bar");

yableau.bar = function(divId, origData, xField, yField, param, attr){

	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));
	
	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : {top:30, left: 50, right: 20, bottom: 20};
	
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
	
	// setup X scale
	xScale = d3.scale.linear()
		.domain([0, d3.max(dataset, function(d){return d.y;})])
		.range([padding.left, width - padding.right]);

	//Define X axis
	xAxis = d3.svg.axis()
			  .scale(xScale)
			  .orient("top")
			  .ticks(3); // tick counts.

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
				d3.select(this).attr({'fill': "#7BCCB5", 'stroke-width': 3, 'stroke': "#000"});
			}else{
				d3.select(this).attr({'fill': "#2B65EC", 'stroke-width': 1, 'stroke': "#ddd"});
			}
		})
		.on("mouseover",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill","#7BCCB5");
		})
		.on("mouseout",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", "#2B65EC");
		})
		.on("click", function(d,i){
			doFilter(this, divId, param, origData, xField, d.x);
		})
		.attr("height",function(d, i) {
			return yScale.rangeBand();
		})
		.transition()
		//.duration(2000)
		.attr("width",function(d, i) {
			return xScale(d.y) - xScale(0);
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
		.attr("text-anchor", "end")
		.attr("y", function(d,i) {
			return yScale(i)+yScale.rangeBand()/2+5;
		})
		.transition()
		//.duration(2000)
		.attr("x", function(d, i) {
			var x = xScale(d.y);
			return x + (x < width/2 ? 20 : -25);
		})
		.attr("font-family", "sans-serif")
		.attr("font-size", "11px")
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
console.log("define yableau.map");

yableau.map = function(divId, origData, xField, yField, param, attr){
	
	var width  = parseInt(d3.select(divId).style("width"));
	var height = parseInt(d3.select(divId).style("height"));

	var attr  = attr ? attr : [];
	var padding = attr.padding ? attr.padding : {top:30, left: 50, right: 20, bottom: 20};
	
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
				d3.select(this).attr({'fill': "orange", 'stroke-width': 3, 'stroke': "#000"});
			}else{
				d3.select(this).attr({'fill': "yellow", 'stroke-width': 1, 'stroke': "#ddd"});
			}
		})
		.on("mouseover",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill","orange");
		})
		.on("mouseout",function(d,i){
			if (getFilterById(divId, param.filters) >= 0) return;
			d3.select(this)
				.attr("fill", "yellow");
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

return yableau;
}();

