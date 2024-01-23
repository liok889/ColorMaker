var RAMP_EDITOR = null;
function RampEditor(svg, uiWidth)
{
    this.svg = svg.append('g');
    this.uiWidth = uiWidth;
    RAMP_EDITOR = this;
}

RampEditor.prototype.dispose = function()
{
    if (this.svg) {
        this.svg.selectAll("*").remove();
    }

}

RampEditor.prototype.selfRemove = function()
{
    (function(obj) {
        obj.removeTimeout =  setTimeout(function() {
            obj.dispose();
        }, 500);
    })(this);
}

RampEditor.prototype.cancelSelfRemove = function()
{
    if (this.removeTimeout!==null && this.removeTimeout!==undefined) {
        clearTimeout(this.removeTimeout);
        this.removeTimeout = null;
    }
}

RampEditor.prototype.setCallback = function(previewCallback, editCallback)
{
    this.previewCallback = previewCallback;
    this.editCallback = editCallback;
}

RampEditor.prototype.render = function(labColor, keyIndex, normKeyIndex)
{
    this.cancelSelfRemove();

    // remove earlier versions
    this.dispose();

    // compute a range of chroma, hue, and (potentially) luminance gradation
    var COMPONENTS = [
        {
            key: 'c',
            step: 7,
            name: 'Chroma',
            range: [0, 100],
        },

        {
            key: 'h',
            step: 40,
            name: 'Hue',
            range: [0, 360-40*2],
        },
    ];

    var COLOR_BOX_WIDTH = 12*1.5;
    var COLOR_ROW_PAD = 5*1.5;
    var COLOR_COL_PAD = 3*1.5;
    var MIN_COLOR_D = 10;

    var rows = [];
    var totalWidth = 0, longestOffset = 0;
    for (var c=0; c < COMPONENTS.length; c++)
    {
        var component = COMPONENTS[c];
        var key = component.key;
        var range = component.range;
        var step = component.step;

        var gradations = [];
        var rowCenter = null;

        function deltaColor(c1, c2) {
            return cie2000Diff(d3.lab(c1), d3.lab(c2));
        }

        for (var tries=0, tryCount=4; tries<tryCount; tries++)
        {
            var color_distance = MIN_COLOR_D;
            for (var dir=0; dir<2; dir++)
            {
                var thisColor = d3.hcl(labColor);
                var direction = dir==0 ? -1 : 1;
                var lastColor = d3.lab(thisColor);


                do
                {
                    thisColor[key] += direction * step;
                    if (thisColor.displayable() || key=='h')
                    {
                        if (key == 'h') {
                            // loop through chroma profiles to find the highest
                            // for this hue
                            for (var c=100; c>= 0; c-=2) {
                                thisColor.c = c;
                                if (thisColor.displayable()) {
                                    break;
                                }
                            }
                            //thisColor.c = Math.min(thisColor.c, 100);
                        }
                        // see if this color is similar to the last color
                        var minColorD = key=='c' ? color_distance/2.5 : color_distance;
                        if (lastColor && deltaColor(lastColor, thisColor) > minColorD)
                        {
                            gradations.push({
                                keyIndex: keyIndex,
                                color: d3.lab(thisColor),
                                original: false,
                            });
                            lastColor = d3.lab(thisColor);
                        }
                    }
                } while  (thisColor[key] >= range[0] && thisColor[key] <= range[1] && (key=='h' || thisColor.displayable()))
                if (dir == 0)
                {
                    gradations.reverse();
                    // add place holder for current color
                    gradations.push({
                        keyIndex: keyIndex,
                        color: d3.lab(labColor),
                        original: true
                    });
                    rowCenter = gradations.length;
                }
            }

            if (gradations.length < 2 && tries < tryCount-1 && key == 'h') {
                console.log("retrying: " + gradations.length)
                color_distance *= .5;
                step=step*.5;
                gradations = [];
            }
            else {
                break;
            }
        }

        var row = {
            rowCenter: rowCenter,
            gradations: gradations,
            left: rowCenter,
            right: gradations.length-rowCenter,

        };
        row.xRange = [
            (.5 + row.left-1) * (COLOR_BOX_WIDTH + COLOR_COL_PAD),
            (.5 + row.right) * (COLOR_BOX_WIDTH + COLOR_COL_PAD),
        ],

        rows.push(row);
        totalWidth = Math.max(totalWidth, gradations.length * (COLOR_BOX_WIDTH + COLOR_COL_PAD));
        longestOffset = Math.max(longestOffset, row.xRange[1]);
    }

    // append background
    var bgRect = this.svg.select("rect.bgRampEditor");
    if (bgRect.size()==0)
    {
        bgRect = this.svg.append('rect').style('fill', '#cccccc')
    }
    bgRect
        .attr('width', totalWidth)
        .attr('height', COMPONENTS.length * (COLOR_BOX_WIDTH+COLOR_ROW_PAD));
    this.bgRect = bgRect;

    var selection = this.svg.selectAll('g.colorRows')
        .data(rows);
    selection = selection.enter().append('g')
        .merge(selection);
    selection.exit().remove();

    // figure x,y ranges:
    var globalRange = [0, 0]
    for (var i=0; i<rows.length; i++)
    {
        var row= rows[i];
        globalRange[0] = Math.max(globalRange[0], row.xRange[0]);
        globalRange[1] = Math.max(globalRange[1], row.xRange[1]);
    }

    (function(globalRange, _selection) {
        _selection
            .attr('transform', function(row, i)
            {
                var xOffset = -row.xRange[0]//globalRange[0]-row.xRange[0] + globalRange[1];// row.xRange[1] //+ (globalOffset-row.xRange[1]);
                var offset =  'translate(' + xOffset + ',' + (i*(COLOR_BOX_WIDTH+COLOR_ROW_PAD)) + ')';
                return offset;
            });
    })(globalRange, selection);

    (function(obj, selection)
    {
        selection.each(function(row, rowIndex)
        {
            d3.select(this).attr("id", 'editor_row_' + rowIndex)
            var colSelection = d3.select(this).selectAll('rect')
                .data(row.gradations)
            colSelection = colSelection.enter().append('rect')
                .merge(colSelection);
            colSelection
                .attr('x', function(d, i) { return i * (COLOR_COL_PAD + COLOR_BOX_WIDTH)})
                .attr('y', 0)
                .attr('width', COLOR_BOX_WIDTH).attr('height', COLOR_BOX_WIDTH)
                .style('stroke', 'black')
                .style('fill', function(d) { return d.color.toString(); })
                .style('stroke-width', function(d, i) {
                    if (i==row.rowCenter-1) {
                        return '2px';
                    } else {
                        return '0.5px';
                    }
                })
                .on('mouseover', function()
                {
                    obj.cancelSelfRemove();
                    d3.select("#editor_row_" + rowIndex)
                        .selectAll('rect').style('stroke-width', '0.5px');
                    d3.select(this)
                        .style('stroke-width', '2px')
                    var color = d3.lab(d3.select(this).style('fill'));
                    //console.log('mouseover edit color: ' + d3.select(this).style('fill') + ', keyIndex: ' + keyIndex);

                    opt.editKey(keyIndex, [
                        color.l,
                        color.a,
                        color.b
                    ]);
                    obj.cancelSelfRemove();
                })
                .on('mouseout', function() {
                    opt.unedit();
                    d3.select("#editor_row_" + rowIndex)
                        .selectAll('rect').style('stroke-width', function(d) {
                            if (d.original) {
                                return '2px';
                            } else {
                                return '0.5px';
                            }
                        });
                    obj.selfRemove();
                })
                .on('click', function()
                {
                    var color = d3.lab(d3.select(this).style('fill'));
                    scaffold.addEditedColorPref(keyIndex, normKeyIndex, [color.l, color.a, color.b]);
                    opt.scheduleReRun();
                    obj.dispose();
                })
        })
    })(this, selection);
    this.globalRange = globalRange;

}

RampEditor.prototype.centerAt = function(x, y)
{
    var bg = this.bgRect;

    bg.style('pointer-events', 'none');
    var _x = x;// +this.bgRect.attr('width')/2;
    var _y = y;// - +this.bgRect.attr('height');

    bgX = -this.globalRange[0];
    bgW = this.globalRange[0] + this.globalRange[1];
    bg
        .attr('x', bgX)
        .attr('width', bgW)
        .style('pointer-events', null);

    var groupX = _x;

    if (bgX + groupX < 0) {
        groupX += -bgX - groupX;
    }
    else if (bgX + _x + bgW > this.uiWidth) {
        groupX -= bgX + _x + bgW-this.uiWidth;
    }
    this.svg.attr('transform', 'translate(' + (groupX) + "," + _y + ")");
    (function(_bg, obj) {
        bg
            .on('mouseout', function()
            {
                var m = d3.mouse(this);
                obj.selfRemove();
            })
            .on('mouseover', function() {
                obj.cancelSelfRemove();
            })
    })(bg, this)
}
