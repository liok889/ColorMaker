function drawAxes() {
    let axes = d3.select('#svgLines');
    var x = d3.scaleLinear()
            .domain([0, 100])
            .range([0, 540]);
    axes.append('g')
        .attr('transform', 'translate(15,120)')
        .call(d3.axisBottom(x).tickValues([]));
    var y = d3.scaleLinear()
            .domain([100, 0])
            .range([0, 80]);
    axes.append('g')
        .attr('transform', 'translate(15,40)')
        .call(d3.axisLeft(y).tickValues([]));
}

function drawLumGraph(cmap) {
    let axes = d3.select('#svgLines');
    axes.selectAll('path.lineGraphLum').remove();
    axes.selectAll('text.lumLabel').remove();
    var W = +d3.select('#svgLines').attr('width')-15;
    var H = +d3.select('#svgLines').attr('height')-55;
    // Draw Line Curves
    var lineGen =  d3.line()
                     .x (function(d) { return (d.x * W); })
                     .y (function(d) { return ((1-d.y) * H) + 40; })

    let colors = cmap.colorMap;
    var lumCurve = [], maxLum = 100.0;
    for (let i=0, len=colors.length; i<len; i++) {
        var xLum = i/(colors.length-1);
        var col = colors[i].lab
        var cLum = col.l;

        lumCurve.push({
            x: xLum,
            y: cLum/maxLum
        });
    }
    axes.append('path')
        .attr('class', 'lineGraphLum')
        .attr('d', lineGen(lumCurve))
        .style('fill', 'none')
        //.style('stroke', '#118000')
        .attr('stroke-dasharray', "4 1")
        .style('stroke', 'black')
        .style('stroke-width', '1.5px')
        .attr('transform', 'translate(15,0)');
    axes.append('text')
        .attr('class', 'lumLabel')
        .attr('x', W-45)
        .attr('y', ((1 - lumCurve[lumCurve.length - 1].y) * H) + 55)
        .style('font-size', '12px')
        //.style('fill', '#118000')
        .style('fill', 'black')
        .text('Luminance');
}

function drawPUGraph(cmap) {
    let axes = d3.select('#svgLines');
    axes.selectAll('text.PULabel').remove();
    axes.selectAll('path.lineGraphPU').remove();
    var W = +d3.select('#svgLines').attr('width')-15;
    var H = +d3.select('#svgLines').attr('height')-55;
    // Draw Line Curves
    var lineGen =  d3.line()
                     .x (function(d) { return (d.x * W); })
                     .y (function(d) { return ((1-d.y) * H) + 40; })

    let colors = cmap.colorMap;
    var cie00Curve = [], max00Dist = [];
    for (let i=0, len=colors.length-1; i<len; i++) {
        var col1 = colors[i].lab;
        var col2 = colors[i+1].lab;

        var distance = cie2000Diff(
            {l: col1.l, a: col1.a, b: col1.b},
            {l: col2.l, a: col2.a, b: col2.b}
        );
        max00Dist.push(distance);
        var maxDist00 = max00Dist.reduce(function(a, b) {
                    return Math.max(a, b);
                }, 0.1);
        cie00Curve.push({
            x: i/(colors.length-1),
            y: distance/maxDist00
        });
    }
    axes.append('path')
        .attr('class', 'lineGraphPU')
        .attr('d', lineGen(cie00Curve))
        .style('fill', 'none')
        .style('stroke', '#3A4CE3')
        .style('stroke-width', '1.5px')
        .attr('transform', 'translate(15,0)');
    axes.append('text')
        .attr('class', 'PULabel')
        .attr('x', W-100)
        .attr('y', ((1 - cie00Curve[cie00Curve.length - 1].y) * H) + 30)
        .style('font-size', '12px')
        .style('fill', '#3A4CE3')
        .text('CIE ΔE2000');
}

function drawSmoGraph(cmap) {
    let axes = d3.select('#svgLines');
    axes.selectAll('path.lineGraphSmo').remove();
    axes.selectAll('text.SmoLabel').remove();
    var W = +d3.select('#svgLines').attr('width')-15;
    var H = +d3.select('#svgLines').attr('height')-55;
    // Draw Line Curves
    var lineGen =  d3.line()
                     .x (function(d) { return (d.x * W); })
                     .y (function(d) { return ((1-d.y) * H) + 40; })

    var smoCurve = [], maxSmo = [];
    for (let i=1, len=cmap.length-1; i<len; i++) {
        var c1 = cmap[i-1];
        var c2 = cmap[i];
        var c3 = cmap[i+1];

        var d1 = delta(c2, c1);
        var d2 = delta(c3, c2);

        var cosine = dot(d1, d2) / (length(d1)*length(d2));
        cosineNorm = cosine * -.5 + .5;

        maxSmo.push(cosineNorm);
        var smoMax = maxSmo.reduce(function(a, b) {
                    return Math.max(a, b);
                }, 0.1);
        smoCurve.push({
            x: i/(cmap.length-1),
            y: cosineNorm/smoMax
        });
    }
    axes.append('path')
        .attr('class', 'lineGraphSmo')
        .attr('d', lineGen(smoCurve))
        .style('fill', 'none')
        .style('stroke', '#D20EAB')
        .style('stroke-width', '1.5px')
        .attr('transform', 'translate(15,0)');
    axes.append('text')
        .attr('class', 'SmoLabel')
        .attr('x', W-55)
        .attr('y', ((1 - smoCurve[smoCurve.length - 1].y) * H) + 30)
        .style('font-size', '12px')
        .style('fill', '#D20EAB')
        .text('Smoothness');
}
