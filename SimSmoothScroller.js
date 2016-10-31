var SimSmoothScroller = (function() {
	var _window = window,
		_doc = document,
		_math = Math;

	var defaultSettings = {
		scrollbarWidth: 14,
		bouncePadding: 30,
		scrollSpeed: 2,
		scrollWheelFrames: 35,
		scrollClickFrames: 25,
		bounceFrames: 7,
		animateAmount: 30
	};

	function SimSmoothScroller(conentElem, options) {

		var _this = this;
		_this.config = extend(defaultSettings, options);

		_this.size = {
			containerHeight: 0,
			contentHeight: 0,
			scrollbarThumbHeight: 0
		};

		_this.position = {
			scrollToBottomPx: 0,
			scrollbarToBottomPx: 0,
			scrollOverlapMin: 0,
			scrollOverlapMax: 0,
			scrollMin: 0,
			scrollMax: 0,
			scrollPosition: 0,
			scrollbarPosition: 0
		};
		_this.animID;

		_this.createDOM = createDOM(_this, conentElem);
		_this.init();
	}

	SimSmoothScroller.prototype.init = function() {
		var _this = this;

		// Apply essential style
		_this.elements.scrollbar.style.width = _this.config.scrollbarWidth + 'px';

		_this.handleAllEvents = handleAllEvents(_this);

		_this.reconfigSize();

		_window.addEventListener('resize', _this.reconfigSize);
		console.log(_this)
	};

	var handleAllEvents = function(_this) {
		_this.clickAndDragHandler = clickAndDragHandler(_this);
		_this.scrollToClickHandler = scrollToClickHandler(_this);
		_this.mouseWheelHandler = mouseWheelHandler(_this);

		return {
			add: function() {
				_this.clickAndDragHandler.add();
				_this.scrollToClickHandler.add();
				_this.mouseWheelHandler.add();
			},
			remove: function() {
				_this.clickAndDragHandler.remove();
				_this.scrollToClickHandler.remove();
				_this.mouseWheelHandler.remove();
			}
		};
	};

	SimSmoothScroller.prototype.reconfigSize = function() {
		// Create local variables
		var _this = this,
			_config = _this.config,
			_size = _this.size,
			_position = _this.position,
			_elements = _this.elements;

		// Get main sizes
		_size.containerHeight = _elements.innerWrapper.offsetHeight;
		_size.contentHeight = _elements.innerWrapper.scrollHeight;

		// Set variabes with math formula
		_size.scrollbarThumbHeight = _size.containerHeight * _size.containerHeight / _size.contentHeight;
		_position.scrollToBottomPx = _size.contentHeight - _size.containerHeight - 3; // 3 because padding on scrollbar
		_position.scrollbarToBottomPx = _size.containerHeight - _size.scrollbarThumbHeight;

		_position.scrollOverlapMin = -_position.scrollToBottomPx - _config.bouncePadding;
		_position.scrollOverlapMax = 0 + _config.bouncePadding;
		_position.scrollMin = -_position.scrollToBottomPx;
		_position.scrollMax = 0;

		// Set size for DOM
		_elements.scrollbarThumb.style.height = _size.scrollbarThumbHeight + 'px';

		if (_elements.scrollbarThumb.offsetHeight < _size.containerHeight) {
			_this.handleAllEvents.add();
			_this.elements.scrollbar.style.opacity = '1';
		} else {
			_this.handleAllEvents.remove();
			_this.elements.scrollbar.style.opacity = '0';
		}
		
		
		
		_this.scrollToPx(_position.scrollPosition, false)
	};

	SimSmoothScroller.prototype.scrollToPx = function(px, shouldBounce) {
		var _this = this,
			scrollTo = scrollToHandler(_this, px, shouldBounce);

		_this.stopScrolling();
		scrollTo();
	};

	SimSmoothScroller.prototype.stopScrolling = function() {
		_window.cancelAnimationFrame(this.animID);
	};

	var mouseWheelHandler = function(_this) {
		var _outerWrapper = _this.elements.outerWrapper,
			scrollTo = scrollToHandler(_this);

		return {
			add: function() {
				_outerWrapper.addEventListener('mousewheel', scrollTo);
				_outerWrapper.addEventListener('DOMMouseScroll', scrollTo);
			},

			remove: function() {
				_outerWrapper.removeEventListener('mousewheel', scrollTo);
				_outerWrapper.removeEventListener('DOMMouseScroll', scrollTo);
			}
		};
	};

	var scrollToClickHandler = function(_this) {
		// Create local Variables
		var _scrollbar = _this.elements.scrollbar,
			_size = _this.size,
			_position = _this.position;

		var click = function(e) {
			if (e.target !== _this.elements.scrollbar) return;

			var getBoundsTop = e.target.getBoundingClientRect().top,
				clientY = e.clientY - _size.scrollbarThumbHeight / 2 - getBoundsTop,
				customChange = 0;

			clientY = clientY * _size.contentHeight / _size.containerHeight;
			customChange = clientY - -_this.position.scrollPosition;

			var scrollTo = scrollToHandler(_this, clientY, false, customChange);
			scrollTo();
		};

		return {
			add: function() {
				_scrollbar.addEventListener('click', click);
			},
			remove: function() {
				_scrollbar.removeEventListener('click', click);
			}
		};
	};

	var clickAndDragHandler = function(_this) {
		var _scrollbarThumb = _this.elements.scrollbarThumb,
			_position = _this.position,
			_size = _this.size;

		var change = 0;

		var mouseMove = function(e) {
				e.preventDefault(); // Prevent dragging other elements (eg. text)

				_position.scrollbarPosition = clamp(e.clientY - change, 0, _position.scrollbarToBottomPx);
				_position.scrollPosition = -_position.scrollbarPosition * _size.contentHeight / _size.containerHeight;
				renderScroll(_this);
			},
			mouseDown = function(e) {
				if (e.target !== _this.elements.scrollbarThumb) return;

				_this.elements.scrollbarThumb.classList.add('SimSmoothScroller_scrollbarThumb_hover');

				_this.stopScrolling();
				change = e.clientY - _this.position.scrollbarPosition;
				_window.addEventListener('mousemove', mouseMove);
			},
			mouseUp = function(e) {
				_this.elements.scrollbarThumb.classList.remove('SimSmoothScroller_scrollbarThumb_hover');
				_window.removeEventListener('mousemove', mouseMove);
			};

		return {
			add: function() {
				_scrollbarThumb.addEventListener('mousedown', mouseDown);
				_window.addEventListener('mouseup', mouseUp);
			},
			remove: function() {
				_scrollbarThumb.removeEventListener('mousedown', mouseDown);
				_window.removeEventListener('mouseup', mouseUp);
			}
		};
	};

	function scrollToHandler(_this, endPosition, shouldBounce, customChange) {
		// Create local variables
		var _config = _this.config,
			_size = _this.size,
			_position = _this.position,
			_elements = _this.elements;

		var direction = 0,
			scrollSpeed = _config.scrollSpeed;

		if (typeof shouldBounce !== 'boolean') shouldBounce = true;

		var utilityOjb = {
			smoothScrollAnim: function() {
				var start = _position.scrollPosition, // Where to start the scroll
					end = (direction !== 0) ? start + _config.animateAmount * scrollSpeed * direction : endPosition, // Where to end the scroll
					change = (typeof customChange === 'number') ? customChange : end - start, // base change in one scroll
					currentFrame = 0, // current frame in animation
					prevScrollPosition = null; // Cannot assign any number yet (i.e. 0), because `scrollPosition` may be that number.
				_this.animID = _window.requestAnimationFrame(animation); // Restart animation

				function animation() {
					_this.animID = _window.requestAnimationFrame(animation); // Restart animation

					_position.scrollPosition = easeOut(currentFrame++, start, -change, _config.scrollWheelFrames); // Get current scroll frames position
					utilityOjb.clampPositions();
					_position.scrollbarPosition = -_position.scrollbarPosition; // Invert scrollbar position
					utilityOjb.convertToScrollbarPos(); // Convert from scrollPosition to scrollThumbPosition
					renderScroll(_this, utilityOjb.squishScrollbarThumb());

					// Check if scroll finished (either animation finished, or bumped to top or bottom)
					if (currentFrame >= _config.scrollWheelFrames || prevScrollPosition === _position.scrollPosition) utilityOjb.finishScrollingWithBounce();
					else prevScrollPosition = _position.scrollPosition;
				}
			},

			finishScrollingWithBounce: function() {
				// Clean up
				scrollSpeed = _config.scrollSpeed;
				_this.stopScrolling();

				// Should bounce? i.e. is it passed the top or bottom?
				if (_position.scrollPosition > 0) {
					utilityOjb.bounceBackHandler();
				} else if (_position.scrollPosition < -_position.scrollToBottomPx) {
					utilityOjb.bounceBackHandler();
				}
			},

			bounceBackHandler: function() {
				_this.stopScrolling(); // Cancel previous animation

				// Create variables
				var up;
				if (_position.scrollPosition > 0) up = true;
				else if (_position.scrollPosition < -_position.scrollToBottomPx) up = false;

				var start = _position.scrollPosition,
					change = (up) ? -_position.scrollPosition : -_position.scrollPosition - _position.scrollToBottomPx,
					currentFrame = 0;

				_this.animID = _window.requestAnimationFrame(smoothBouncBack); // Start animation

				function smoothBouncBack() {
					_this.animID = _window.requestAnimationFrame(smoothBouncBack); // Restart animation

					_position.scrollPosition = outQuartic(currentFrame++, start, change, _config.bounceFrames);
					renderScroll(_this, utilityOjb.squishScrollbarThumb());

					if ((_position.scrollPosition <= 0 && up) || (_position.scrollPosition >= -_position.scrollToBottomPx && !up))
						_this.stopScrolling();
				}
			},

			squishScrollbarThumb: function() {
				if (!shouldBounce) return '';
				var transformOrigin = '',
					outOfBoundAmount = 0;

				// Setup variables for squish if applicable
				if (_position.scrollPosition > 0) {
					outOfBoundAmount = -_position.scrollPosition;
					transformOrigin = 'top';
				} else if (_position.scrollPosition < -_position.scrollToBottomPx) {
					outOfBoundAmount = -_position.scrollPosition - _position.scrollToBottomPx;
					transformOrigin = 'bottom';
				}

				// Should squish scrollbar?
				if (outOfBoundAmount !== 0) {
					var scaleY = _size.containerHeight / (_size.containerHeight + _math.abs(outOfBoundAmount));
					_elements.scrollbarThumb.style.transformOrigin = 'center ' + transformOrigin + ' 0px';
					return ' scale3d(1, ' + scaleY + ', 1)';
				} else {
					return '';
				}
			},

			clampPositions: function() {
				if (shouldBounce) _position.scrollPosition = clamp(_position.scrollPosition, _position.scrollOverlapMin, _position.scrollOverlapMax);
				else _position.scrollPosition = clamp(_position.scrollPosition, _position.scrollMin, _position.scrollMax);
				_position.scrollbarPosition = clamp(_position.scrollPosition, _position.scrollMin, _position.scrollMax);
			},

			convertToScrollbarPos: function() {
				_position.scrollbarPosition = _size.containerHeight * _position.scrollbarPosition / _size.contentHeight;
			}
		};

		var mouseWheel = function(e) {
			_this.stopScrolling(); // Cancel previous animation

			if (typeof e === 'object') {
				e.preventDefault() // Prevent parent element from scrolling

				scrollSpeed++; // Scroll faster

				var localDirection = (e.detail < 0 || e.wheelDelta > 0) ? -1 : 1; // 1 = scroll down, -1 = scroll up
				// Check if scroll direction changed
				if (direction != localDirection) {
					// Start slowly - restart speed
					scrollSpeed = _config.scrollSpeed;
					direction = localDirection;
				}
			}
			utilityOjb.smoothScrollAnim(); // Start animation
		};

		return mouseWheel;
	};

	function createDOM(_this, contentElem) {
		var outerWrapper = _doc.createElement('div'),
			innerWrapper = _doc.createElement('div'),
			scrollbar = _doc.createElement('div'),
			scrollbarThumb = _doc.createElement('div');

		outerWrapper.className = 'SimSmoothScroller_outerWrapper';
		innerWrapper.className = 'SimSmoothScroller_innerWrapper';
		scrollbar.className = 'SimSmoothScroller_scrollbar';
		scrollbarThumb.className = 'SimSmoothScroller_scrollbarThumb';

		outerWrapper.appendChild(innerWrapper);
		contentElem.parentElement.insertBefore(outerWrapper, contentElem);
		innerWrapper.appendChild(contentElem);
		scrollbar.appendChild(scrollbarThumb);
		outerWrapper.appendChild(scrollbar);

		_this.elements = {
			outerWrapper: outerWrapper,
			innerWrapper: innerWrapper,
			content: contentElem,
			scrollbar: scrollbar,
			scrollbarThumb: scrollbarThumb
		};
	}

	function renderScroll(_this, scale3d) {
		if (typeof scale3d !== 'string') scale3d = '';

		_this.elements.innerWrapper.style.transform = 'translate3d(0px, ' + _this.position.scrollPosition + 'px, 0px)';
		_this.elements.scrollbarThumb.style.transform = 'translate3d(0px, ' + _this.position.scrollbarPosition + 'px, 0px)' + scale3d;
	}

	function easeOut(time, begin, change, duration) {
		time /= duration;
		return -change * time * (time - 2) + begin;
	}

	function outQuartic(t, b, c, d) {
		t /= d;
		return b + c * (t);
	}

	function clamp(val, min, max) {
		if (typeof min !== 'number') min = 0;
		if (typeof max !== 'number') max = 1;
		return Math.min(Math.max(val, min), max);
	}

	function extend(defaults, config) {
		if (!isObject(defaults)) defaults = {};
		if (!isObject(config)) config = {};

		var obj = {};
		for (var key in defaults) {
			if (!defaults.hasOwnProperty(key)) continue;
			obj[key] = (config.hasOwnProperty(key)) ? config[key] : defaults[key];
		}
		return obj;
	}

	function isObject(val) {
		if (val === null) return false;
		return ((typeof val === 'function') || (typeof val === 'object'));
	}

	return SimSmoothScroller;
})();
