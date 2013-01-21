/*! Smooth Scroll - v1.4.7 - 2012-10-29
* Copyright (c) 2012 Karl Swedberg; Licensed MIT, GPL */

;(function($) {

    var version = '1.4.7',
    defaults = {
        exclude: [],
        excludeWithin:[],
        offset: 0,
        direction: 'top', // one of 'top' or 'left'
        scrollElement: null, // jQuery set of elements you wish to scroll (for $.smoothScroll).
        //  if null (default), $('html, body').firstScrollable() is used.
        scrollTarget: null, // only use if you want to override default behavior
        beforeScroll: function() {},  // fn(opts) function to be called before scrolling occurs. "this" is the element(s) being scrolled
        afterScroll: function() {},   // fn(opts) function to be called after scrolling occurs. "this" is the triggering element
        easing: 'swing',
        tweenEaseFunc: window['Quart'] ? Quart.easeInOut : null,
        useTweenLite: true,
        speed: 0.400,                     // this is the time that the transition will take (in seconds) - can be 'auto' and it will use the velocity value
        maxTime: 1.25,                     // this is the maximum time it will take to scroll (in seconds)
        minTime: 0.125,                    // this is the minimum time it will take to scroll (in seconds)
        velocity: 750,                     // used for the auto speed value
        autoCoefficent: 2 // coefficient for "auto" speed
    },

    getScrollable = function(opts) {
        var scrollable = [],
        scrolled = false,
        dir = opts.dir && opts.dir == 'left' ? 'scrollLeft' : 'scrollTop';

        this.each(function() {

            if (this == document || this == window) {
                return;
            }
            var el = $(this);
            if ( el[dir]() > 0 ) {
                scrollable.push(this);
            } else {
                // if scroll(Top|Left) === 0, nudge the element 1px and see if it moves
                el[dir](1);
                scrolled = el[dir]() > 0;
                if ( scrolled ) {
                    scrollable.push(this);
                }
                // then put it back, of course
                el[dir](0);
            }
        });

        // If no scrollable elements, fall back to <body>,
        // if it's in the jQuery collection
        // (doing this because Safari sets scrollTop async,
        // so can't set it to 1 and immediately get the value.)
        if (!scrollable.length) {
            this.each(function(index) {
                if (this.nodeName === 'BODY') {
                    scrollable = [this];
                }
            });
        }

        // Use the first scrollable element if we're calling firstScrollable()
        if ( opts.el === 'first' && scrollable.length > 1 ) {
            scrollable = [ scrollable[0] ];
        }

        return scrollable;
    },
    isTouch = 'ontouchend' in document;

    $.fn.extend({
        scrollable: function(dir) {
            var scrl = getScrollable.call(this, {
                dir: dir
            });
            return this.pushStack(scrl);
        },
        firstScrollable: function(dir) {
            var scrl = getScrollable.call(this, {
                el: 'first',
                dir: dir
            });
            return this.pushStack(scrl);
        },

        smoothScroll: function(options) {
            options = options || {};
            var opts = $.extend({}, $.fn.smoothScroll.defaults, options),
            locationPath = $.smoothScroll.filterPath(location.pathname);

            this
            .unbind('click.smoothscroll')
            .bind('click.smoothscroll', function(event) {
                var link = this,
                $link = $(this),
                exclude = opts.exclude,
                excludeWithin = opts.excludeWithin,
                elCounter = 0, ewlCounter = 0,
                include = true,
                clickOpts = {},
                hostMatch = ((location.hostname === link.hostname) || !link.hostname),
                pathMatch = opts.scrollTarget || ( $.smoothScroll.filterPath(link.pathname) || locationPath ) === locationPath,
                thisHash = escapeSelector(link.hash),
                $offsetEl = opts.offsetEl != null && opts.offsetEl != undefined ? $(opts.offsetEl) : null;  // this is used to dynamically calculate the offset on each click

                if ( !opts.scrollTarget && (!hostMatch || !pathMatch || !thisHash) ) {
                    include = false;
                } else {
                    while (include && elCounter < exclude.length) {
                        if ($link.is(escapeSelector(exclude[elCounter++]))) {
                            include = false;
                        }
                    }
                    while ( include && ewlCounter < excludeWithin.length ) {
                        if ($link.closest(excludeWithin[ewlCounter++]).length) {
                            include = false;
                        }
                    }
                }

                if ( include ) {
                    event.preventDefault();

                    $.extend( clickOpts, opts, {
                        scrollTarget: opts.scrollTarget || thisHash,
                        link: link,
                        offsetEl: $offsetEl
                    });

                    $.smoothScroll( clickOpts );
                }
            });

            return this;
        }
    });

    $.smoothScroll = function(options, px) {
        var opts, $scroller, scrollTargetOffset, speed,
        scrollerOffset = 0,
        offPos = 'offset',
        scrollDir = 'scrollTop',
        aniProps = {delay:0.05},
        aniOpts = {},
        scrollprops = [],
        elementOffset = 0;

        if (typeof options === 'number') {
            opts = $.fn.smoothScroll.defaults;
            scrollTargetOffset = options;
        } else {
            opts = $.extend({}, $.fn.smoothScroll.defaults, options || {});
            if (opts.scrollElement) {
                offPos = 'position';
                if (opts.scrollElement.css('position') == 'static') {
                    opts.scrollElement.css('position', 'relative');
                }
            }
        }

        opts = $.extend({
            link: null
        }, opts);
        scrollDir = opts.direction == 'left' ? 'scrollLeft' : scrollDir;

        if ( opts.scrollElement ) {
            $scroller = opts.scrollElement;
            scrollerOffset = $scroller[scrollDir]();
        } else {
            $scroller = $('html, body').firstScrollable();
        }


        // check for the existence of the offset element - which is what is checked for height + scrollTop (or width + scrollLeft) to add to the offset value
        if(opts.offsetEl) {
            var sizeDir = opts.direction == 'left' ? 'width' : 'height';
            var posDir = opts.direction == 'left' ? 'left' : 'top';
            elementOffset = parseInt(opts.offsetEl.css(posDir)) + opts.offsetEl[sizeDir]();
        }

        // make sure we have tweenlite on the page before attempting to use it
        opts.useTweenLite = opts.useTweenLite && window['TweenLite'] != undefined;

        // beforeScroll callback function must fire before calculating offset
        opts.beforeScroll.call($scroller, opts);

        scrollTargetOffset = (typeof options === 'number') ? options :
        px ||
        ( $(opts.scrollTarget)[offPos]() &&
            $(opts.scrollTarget)[offPos]()[opts.direction] ) ||
        0;

        aniProps[scrollDir] = scrollTargetOffset + scrollerOffset + opts.offset - elementOffset;
        speed = opts.speed;

        // automatically calculate the speed of the scroll based on distance / coefficient
        if (speed === 'auto') {

            // if aniProps[scrollDir] == 0 then we'll use scrollTop() value instead
            var distance = aniProps[scrollDir] || $scroller.scrollTop();

            var topValue =  scrollTargetOffset;

            // need to check that the value we are scrolling to is not below the absolute bottom of the screen
            topValue = topValue +  $(opts.scrollTarget).outerHeight() || 0 > $(window).height() ?  $(opts.scrollTarget).scrollTop() || 0 - $(window).height() : topValue;

            var d = $scroller.scrollTop() - topValue;
            speed = Math.abs(d / opts.velocity);
        }

        // make sure the speed is inside the range specified by min and max times
        speed = speed > opts.maxTime ? opts.maxTime : speed < opts.minTime ? opts.minTime : speed;

        if(opts.useTweenLite) {
            if ($scroller.length) {
                aniProps = $.extend(aniProps, {
                    ease:opts.tweenEaseFunc,
                    onComplete:function() {
                        opts.afterScroll.call(opts.link, opts);
                    }
                });
			setTimeout(function(){
	            TweenLite.to($scroller, speed, aniProps);				
			}, 40);
        } else {
            opts.afterScroll.call(opts.link, opts);
        }
    }else{
        aniOpts = {
            duration: speed * 1000, // duration must be in milliseconds for jquery
            easing: opts.easing,
            complete: function() {
                opts.afterScroll.call(opts.link, opts);
            }
        };

        if (opts.step) {
            aniOpts.step = opts.step;
        }

        if ($scroller.length) {
            $scroller.stop().animate(aniProps, aniOpts);
        } else {
            opts.afterScroll.call(opts.link, opts);
        }
    }
};

$.smoothScroll.version = version;
$.smoothScroll.filterPath = function(string) {
    return string
    .replace(/^\//,'')
    .replace(/(index|default).[a-zA-Z]{3,4}$/,'')
    .replace(/\/$/,'');
};

// default options
$.fn.smoothScroll.defaults = defaults;

function escapeSelector (str) {
    return str.replace(/(:|\.)/g,'\\$1');
}

})(jQuery);
