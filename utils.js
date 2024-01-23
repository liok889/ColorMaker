
function isNumber(value)
{
   return typeof value === 'number' && isFinite(value);
}

function addMMCallback(element, container, callback, callbackDown, callbackUp, callbackIn, callbackOut, minDistance)
{
    function mouseToContainer(_e, _c) {
        return d3.mouse(_c ? _c: _e.node());
    }
    function normalizedMouse(_element, _container)
    {
        var m = mouseToContainer(_element, _container);
        if (m[0]<0) {m[0] = 0};
        if (m[1]<0) {m[1] = 0};

        var w = (_container ? d3.select(_container) : element).attr('width');
        var h = (_container ? d3.select(_container) : element).attr('height');
        var x = Math.min(1, m[0]/(+w));
        var y = Math.min(1, m[1]/(+h));
        return [x, y]
    }

    element.on('mouseover', function() {
        var m = normalizedMouse(element, container);
        mDown = mouseToContainer(element, container);
        if (callbackIn) {
            callbackIn(m[0], m[1])
        }
    })
    element.on('mouseout', function() {
        var m = normalizedMouse(element, container);
        mDown = mouseToContainer(element, container);
        if (callbackOut) {
            callbackOut(m[0], m[1])
        }
    })

    element.on('mousedown', function()
    {
        var m = normalizedMouse(element, container);
        mDown = mouseToContainer(element, container); minDistanceAchieved = !isNumber(minDistance);
        if (callbackDown) {
            callbackDown(m[0], m[1])
        }
        //callback(m[0], m[1]);
        d3.select(document).on('mousemove.mMove', function()
        {
            var m = normalizedMouse(element, container);

            if (!minDistanceAchieved)
            {
                var curMouse = mouseToContainer(element, container);
                var dMouse = [curMouse[0]-mDown[0], curMouse[1]-mDown[1]];
                var len = Math.sqrt( Math.pow(dMouse[0], 2) + Math.pow(dMouse[1], 2) );
                if (len < minDistance) {
                    return;
                }
                else {
                    minDistanceAchieved = true;
                }
            }

            callback(m[0], m[1]);
        })
        d3.select(document).on('mouseup.mMove', function() {
            if (callbackUp) {
                callbackUp();
            }
            d3.select(document)
                .on('mousemove.mMove', null)
                .on('mouseup.mMove', null);
        });

    });
}

function ShadowedText(svg, text, x, y)
{
    this.g = svg.append('g');
    this.x = x || 0;
    this.y = y || 0;
    this.g
        .attr('transform', 'translate(' + (this.x) + ',' + (this.y) + ')');
    this.light = this.g.append('text')
        .html(text||'')
        .style('fill', 'white');
    this.dark = this.g.append('text')
        .html(text || null)
        .style('fill', 'black')
        .attr('x', -1)
        .attr('y', -1)
}
ShadowedText.prototype.textAnchor = function(anchor)
{
    this.light.attr('text-anchor', anchor);
    this.dark.attr('text-anchor', anchor);
}
ShadowedText.prototype.lightBackground = function()
{
    putNodeOnTop(this.dark.node());
    return this;
}
ShadowedText.prototype.darkBackground = function()
{
    putNodeOnTop(this.light.node());
    return this;
}

ShadowedText.prototype.attr = function(attrName, value)
{
    this.g.selectAll('text')
        .attr(attrName, value);
    return this;
}

ShadowedText.prototype.setText = function(text)
{
    this.dark.html(text);
    this.light.html(text);
}
ShadowedText.prototype.setX = function(xValue)
{
    this.x = xValue;
    this.g.attr('transform', 'translate(' + (this.x) + ',' + (this.y) + ')');
    return this;
}


ShadowedText.prototype.setY = function(yValue)
{
    this.y = yValue;
    this.g.attr('transform', 'translate(' + (this.x) + ',' + (this.y) + ')');
    return this;
}

// places node on top in its existing DOM heirarchy
function putNodeOnTop(node)
{
    var n = jQuery(node);
    n.parent().append(n.detach());
}

// returns the closest in-gamut lab color (as measured using manhattan distance)
function trimColorToGamut(labColor, constructor)
{
    var TRIM_UNIT = 0.5;
    function sign(a) { if (a>=0) { return 1; } else { return -1; } }

    if (!constructor) {
        constructor = d3.lab
    }
    var copyColor = constructor(labColor.l, labColor.a, labColor.b);
    while (!copyColor.displayable() && (copyColor.a != 0 && copyColor.b != 0))
    {
        var AB;
        if (copyColor.a == 0)
        {
            // decrease B
            AB = false;
        } else if (copyColor.b == 0)
        {
            // decrease A
            AB = true;
        }
        else {
            if (Math.abs(copyColor.a-labColor.a) <= Math.abs(copyColor.b-labColor.b)) {
                // B is closer to original color than A: decrease B
                AB = true;
            }
            else {
                AB = false;
            }
        }

        if (AB) {
            if (Math.abs(copyColor.a) < TRIM_UNIT) {
                copyColor.a = 0;
            }
            else {
                copyColor.a += -1 * sign(copyColor.a) * TRIM_UNIT;
            }
        }
        else {
            if (Math.abs(copyColor.b) < TRIM_UNIT) {
                copyColor.b = 0;
            }
            else {
                copyColor.b += -1 * sign(copyColor.b) * TRIM_UNIT;
            }
        }
    }
    return copyColor;
}
