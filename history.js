var HIST_SERIAL=0;
var ELEMENT_H = 26;
var COLORMAP_HIST_H = ELEMENT_H-6;
var COLORMAP_HIST_W = 200;

// transition time: 100 mili
var TRANSITION_TIME = 100;

// element to store a historical solution, its score,
// and its children (alternative derivative designs discovered ffrom optimization)
function HistoryElement(solution, score)
{
    this.children = [];
    this.solution = solution;
    this.score = score;
    this.expanded = false;
    this.serial = HIST_SERIAL++;
    this.userPrefs = scaffold.copyUserPrefs();
}

var histTimeout = null;

function previewHistory(element)
{
    if (histTimeout != null) {
        clearTimeout(histTimeout);
        histTimeout = null;
    }

    d3.select('#colormapStats').selectAll('path').remove();
    d3.select('#colormapStats').selectAll('circle').remove();
    d3.select('g#colormapUI').selectAll('rect.userPrefColors').remove();
    d3.select('g#colormapUI').selectAll('image.userPrefGradient').remove();

    d3.selectAll('.cvdImage, .cvdText').remove();

    //solution = this.solution;
    opt.updateSolution(copySolution(element.solution));                          // Update Canvas & Plots
    examples.setColorMap(opt.getColorMap());                    // Update Scalar Fields
    combinedMapModule.updateChoroplethMap1(opt.getColorMap());  // Update Choropleth
    combinedMapModule.updateChoroplethMap2(opt.getColorMap());  // Update Choropleth
    scaffold.flashUserPrefs(element.userPrefs);                   // Update Input
    scaffold.addCallback(element.luminanceProfile);
    if(binImgFlag == true) { loadAndDisplayImage(opt.getColorMap()); }

    var selectedType = document.getElementById("visionDropdown").value;
    if(selectedType !== 'normal') {
        var cvdMap = cvdSimulation(opt.getColorMap(), selectedType);
        drawCVDImage(cvdMap);
    }

    let selLines = d3.selectAll('.linesButton:checked').nodes();
    selLines.forEach(function(checkbox) {
        let selLine = checkbox.id;
        if(selLine === 'luminance') { drawLumGraph(opt.getColorMap()); }
        else if (selLine === 'perc_uniformity') { drawPUGraph(opt.getColorMap()); }
        else if (selLine === 'smoothness') { drawSmoGraph(opt.getSolution()); }
    });

    appendElements(opt.getSolution());
    updateLuminanceProfile(element.luminanceProfile);
}

function returnPreviewToTop()
{
    var historyWidget = hist;
    if (histTimeout != null) {
        clearTimeout(histTimeout);
        histTimeout = null;
    }
    histTimeout = setTimeout(function()
    {
        if (!historyWidget.list[histCurr]) {
            return;
        }

        var topElement = historyWidget.list[histCurr];
        previewHistory(topElement);
        scaffold.restoreUserPrefs(topElement.userPrefs);        // Update Input
        updateLuminanceProfile(profileSelection ? profileSelection : topElement.luminanceProfile);
    }, 100);
}

function moveSelectionMarker(index)
{
    if (index === undefined) {
        index = histCurr;
    }

    if (hist.list.length == 0) {
        d3.selectAll('rect.histBut').remove()
    }
    else {
        var button = d3.selectAll('rect.histBut');
        if (button.size() == 0) {
            button = d3.select('g#historyGroup').append("rect")
                .attr('class', 'histBut')
                .attr('class', 'histBut')
                .attr('width', COLORMAP_HIST_W)
                .attr('height', COLORMAP_HIST_H)
                .style('fill', 'none')
                .style('stroke', 'black')
                .style('stroke-width', '1px');
        }

        button
            .attr('y', ELEMENT_H * (index));

        putNodeOnTop(button.node());

        // activate preview icon
        d3.selectAll('image.previewIcon').style('opacity', '0.2')
        hist.list[index].imagePreview.style('opacity', '1.0')
    }
}
function changeSelectedHistory(element)
{
    // change currHist to element specified
    if (element) {
        histCurr = hist.findIndex(element);
    }
    else {
        element = hist.list[histCurr];
    }

    // show the colormap (and its curves etc...)
    previewHistory(element);

    // apply border to selected history element
    moveSelectionMarker();

    var histWidget = hist;

    //d3.select('#colormapStats').selectAll('path').remove();
    //d3.select('#colormapStats').selectAll('circle').remove();
    d3.select('g#colormapUI').selectAll('rect.userPrefColors').remove();
    d3.select('g#colormapUI').selectAll('image.userPrefGradient').remove();
    d3.selectAll('.cvdImage, .cvdText').remove();

    // Update Input
    d3.select('g#colormapUI').selectAll('rect.userPrefColors').remove();
    d3.select('g#colormapUI').selectAll('image.userPrefGradient').remove();

    scaffold.setNewPrefs(element.userPrefs);
    //scaffold.userPrefs = historyWidget.list[histCurr].userPrefs;

    opt.updateSolution(copySolution(element.solution));                          // Update Canvas & Plots
    examples.setColorMap(element.colormap);                        // Update Scalar Fields
    combinedMapModule.updateChoroplethMap1(element.colormap);      // Update Choropleth
    combinedMapModule.updateChoroplethMap2(element.colormap);      // Update Choropleth
    scaffold.addCallback(element.luminanceProfile);
    if(binImgFlag == true) {
        loadAndDisplayImage(element.colormap);
    }

    var selectedType = document.getElementById("visionDropdown").value;
    if(selectedType !== 'normal') {
        var cvdMap = cvdSimulation(element.colormap, selectedType);
        drawCVDImage(cvdMap);
    }

    let selLines = d3.selectAll('.linesButton:checked').nodes();
    selLines.forEach(function(checkbox) {
        let selLine = checkbox.id;
        if(selLine === 'luminance') { drawLumGraph(opt.getColorMap()); }
        else if (selLine === 'perc_uniformity') { drawPUGraph(opt.getColorMap()); }
        else if (selLine === 'smoothness') { drawSmoGraph(opt.getSolution()); }
    });

    appendElements(histWidget.list[histCurr].solution);
    updateLuminanceProfile(element.luminanceProfile);
}

HistoryElement.prototype.render = function(g)
{
    histCurr = 0;
    this.colormap = colormapFromSolution(this.solution);
    var historyWidget = this.historyWidget;

    var container = g.append("g");

    //d3.selectAll('rect.histBut').style('stroke-width', '0px');
    d3.selectAll('rect.hist').style('stroke-width', '0px');


    (function(_container, obj)
    {
        // append close image
        _container.append('image')
            .attr('xlink:href', 'profile/close-button-black.png')
            .attr('x', -COLORMAP_HIST_H - 2)
            .attr('width', COLORMAP_HIST_H)
            .attr('height', COLORMAP_HIST_H)
            .style('opacity', '0.2')
            .on('mouseover', function() {
                d3.select(this).style('opacity', '1.0')
            })
            .on('mouseout', function() {
                d3.select(this).style('opacity', '0.2');
            })
            .on('click', function() {
                _container.selectAll('*').remove();
                obj.historyWidget.deleteElement(obj);
            });

        // append close image
        obj.imagePreview = _container.append('image')
            .attr('xlink:href', 'profile/preview.png')
            .attr('x', COLORMAP_HIST_W + 2)
            .attr('width', COLORMAP_HIST_H*1.5)
            .attr('height', COLORMAP_HIST_H)
            .style('opacity', '0.2')
            .attr('class', 'previewIcon')
            .on('mouseover', function()
            {
                d3.select(this).style('opacity', '1.0');
                previewHistory(obj);
            })
            .on('mouseout', function() {
                d3.select(this).style('opacity', '0.2');
                returnPreviewToTop();
                moveSelectionMarker();

            })
            .on('click', function()
            {
                changeSelectedHistory(obj);
            });

        // rectangle
        /*
        _container.append("rect")
            .attr('class', 'hist')
            .attr('width', COLORMAP_HIST_W)
            .attr('height', COLORMAP_HIST_H)
            .style('fill', 'none')
            .style('stroke', 'black')
            .style('stroke-width', '2px');
        */

        obj.image = _container.append("image")
            .attr('x', 0)
            .attr('y', 0)
            .data([{ serial: obj.serial }])
            .attr('width', COLORMAP_HIST_W)
            .attr('height', COLORMAP_HIST_H)
            .attr('xlink:href', 'your-image-url.jpg')
            .on('click', function()
            {
                changeSelectedHistory(obj);
            });
    })(container, this);

    moveSelectionMarker();


    // // add dropdown for history
    // this.histArrow = container.append('text')
    //                         .attr('id', 'histArrow')
    //                         .attr("class", 'fa')
    //                         .attr('x', -15)
    //                         .attr('y', COLORMAP_HIST_H-2)
    //                         .style('font-size', 15)
    //                         .attr('fill', '#222021')
    //                         .text("\uf0d7");



    // next button
    var nextBut = d3.select('#downArrow');
    if(historyWidget.list.length == 1) {
        nextBut.attr('fill', '#a9a9a9')
            .on('mouseover', function() {
                nextBut.style('cursor', 'not-allowed');
            });
    }
    else {
        nextBut.attr('fill', '#222021');
        nextBut.on('mouseover', function() {
            if (histCurr == (historyWidget.list.length - 1)) {
                nextBut.attr('fill', '#a9a9a9').style('cursor', 'not-allowed');
            } else {
                nextBut.attr('fill', '#222021').style('cursor', 'pointer');
            }
        })
        .on('click', function() {
                if(histCurr < historyWidget.list.length-1) {
                    prevBut.attr('fill', '#222021');
                    histCurr++;
                    var element = historyWidget.list[histCurr];
                    changeSelectedHistory(element);
                }
                else {
                    return;
                }
            });
    }

    // prev button
    var prevBut = d3.select('#upArrow');

    if(historyWidget.list.length == 1) {

        prevBut.attr('fill', '#a9a9a9')
            .on('mouseover', function() {
                prevBut.style('cursor', 'not-allowed');
            });
    }
    else {
        prevBut.attr('fill', '#a9a9a9')
        prevBut.on('mouseover', function() {
            if (histCurr === 0) {
                prevBut.attr('fill', '#a9a9a9').style('cursor', 'not-allowed');
            } else {
                prevBut.attr('fill', '#222021').style('cursor', 'pointer');
            }
        })
        .on('click', function() {
                if(histCurr > 0) {
                    nextBut.attr('fill', '#222021');
                    histCurr--;
                    var element = historyWidget.list[histCurr];
                    changeSelectedHistory(element);
                }
            });
    }

    colormapToImage(this.colormap, this.image);
}

// HistoryWidget: displays all history elements in a list
// while allowing interactions with them (adding new elements, removing, expanding children)
function HistoryWidget(svg, w)
{
    this.svg = svg;
    this.w = w;
    this.list = [];
    this.updateSize();
}

HistoryWidget.prototype.findIndex = function(element) {
    for (var i=0, len=this.list.length; i<len; i++) {
        if (this.list[i]==element) {
            return i;
        }
    }
    return -1;
}
HistoryWidget.prototype.deleteElement = function(element)
{
    var index = this.findIndex(element);
    this.list.splice(index, 1);
    this.shiftDown(index);

    // what to do with currHist element
    if (this.list.length == 0) {
        // no more entries
        //d3.select(".histBut").remove();
        histCurr = Math.max(0, Math.min(histCurr, this.list.length-1));

    }
    else if (index > histCurr)
    {
        // deleting an element below us
        // do nothing
        //histCurr = Math.max(0, Math.min(histCurr, this.list.length-1));

    }
    else if (index == histCurr) {
        // we are currently
        if (histCurr < this.list.length)
        {
            // select element right below us
        }
        else {
            // move history up
            histCurr--;
        }
        //histCurr = Math.max(0, Math.min(histCurr, this.list.length-1));
        changeSelectedHistory();
    }
    else if (index < histCurr) {
        histCurr--;
    }
    histCurr = Math.max(0, Math.min(histCurr, this.list.length-1));
    moveSelectionMarker();

    // update svg height
    this.updateSize();
}

HistoryWidget.prototype.shiftDown = function(index)
{
    var startingH = 0;
    for (var i=0; i<index && i<this.list.length; i++)
    {
        startingH += ELEMENT_H;
        if (this.list[i].expanded) {
            startingH += this.list[i].children.length * ELEMENT_H;
        }
    }

    for (var I=0, i=index; i<this.list.length; i++, I++)
    {
        var h = startingH + I*ELEMENT_H;
        var serial = this.list[i].serial;
        d3.select("#history_" + serial)
            .transition().duration(TRANSITION_TIME)
            .attr('transform', 'translate(0,' + h + ')');
    }
}

HistoryWidget.prototype.updateSize = function()
{
    var g = d3.select("#historyGroup");
    var h = ELEMENT_H*this.list.length//g.node().getBoundingClientRect().height;
    d3.select('#svgHistory')
        .attr('height', h + 30);
}
HistoryWidget.prototype.add = function(solution, score)
{
    var e = new HistoryElement(copySolution(solution), score);
    e.historyWidget = this;
    e.luminanceProfile = getLuminanceProfile().getProfileType();

    this.list.splice(0, 0, e);

    // move everything down by X amount
    this.shiftDown(1, ELEMENT_H);

    // add a new element at the top of the svg
    var newGroup = this.svg.append('g')
        .attr('id', 'history_' + e.serial)
        .attr('transform', 'translate(0,0)')
    e.render(newGroup);
    this.updateSize();

}

HistoryWidget.prototype.clear = function()
{
    histTop=0;
    histCurr=0;
    this.list = [];
    this.svg.selectAll('*').remove();
    this.updateSize();
}
