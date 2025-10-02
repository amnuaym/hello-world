/*
	Prologue by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function($) {

	var	$window = $(window),
		$body = $('body'),
		$nav = $('#nav');

	// Debug: confirm toggle and header elements are present
	$(function() {
		var $t = $('#sidebar-toggle');
		var $h = $('#header');
		if (window && window.console && console.log) console.log('[main.js] init, sidebar-toggle exists=', $t.length, 'header exists=', $h.length);
	});

	// Ensure Font Awesome fallback SVG is hidden when the webfont is available
	(function() {
		var $toggle = $('#sidebar-toggle');
		var $svg = $toggle.find('.sidebar-toggle-fallback');

		function hideFallback() {
			if ($svg.length) $svg.css('display', 'none');
		}

		// Use Font Loading API when available
		if (document.fonts && document.fonts.check) {
			// Check for the solid weight used by FA
			if (document.fonts.check('1em "Font Awesome 6 Free"') || document.fonts.check('1em "Font Awesome 5 Free"')) {
				hideFallback();
			} else {
				// Attempt to load then check
				document.fonts.ready.then(function() {
					if (document.fonts.check('1em "Font Awesome 6 Free"') || document.fonts.check('1em "Font Awesome 5 Free"'))
						hideFallback();
				}).catch(function(){/* ignore */});
			}
		} else {
			// Fallback: check computed font-family of the <i> element
			var $i = $toggle.find('i');
			if ($i.length) {
				var ff = window.getComputedStyle($i[0]).getPropertyValue('font-family');
				if (ff && /Font Awesome/i.test(ff)) hideFallback();
			}
		}
	})();

	// Collapsible sidebar functionality
	(function() {
		var $toggle = $('#sidebar-toggle'),
			$header = $('#header');

		function setState(collapsed) {
			if (collapsed) {
				$header.addClass('collapsed');
				$toggle.attr('aria-expanded', 'false');
				$toggle.attr('aria-label', 'Expand sidebar');
				// Ensure visual toggle reflects collapsed state
				$toggle.removeClass('open');
			} else {
				$header.removeClass('collapsed');
				$toggle.attr('aria-expanded', 'true');
				$toggle.attr('aria-label', 'Collapse sidebar');
				// Ensure visual toggle reflects expanded state
				$toggle.addClass('open');
			}
		}

		// Initialize state based on existing class (useful if server renders collapsed)
		// On mobile widths prefer the panel state (body.header-visible), otherwise use header.collapsed
		// Also persist mobile preference in a data attribute so accidental resize handling
		// doesn't clear the user's choice.
		if (window.innerWidth <= 960) {
			var mobileVisible = $body.hasClass('header-visible');
			$toggle.attr('aria-expanded', mobileVisible ? 'true' : 'false');
			$toggle.attr('aria-label', mobileVisible ? 'Collapse sidebar' : 'Expand sidebar');
			// Persist preference so resize won't accidentally clear it
			$body.attr('data-sidebar-visible', mobileVisible ? 'true' : 'false');
			// Mirror visual open state on the toggle button
			if (mobileVisible) $toggle.addClass('open'); else $toggle.removeClass('open');
		} else {
			setState($header.hasClass('collapsed'));
		}

		// Unified pointer handler (covers mouse, touch, pen). Adds logging to help debug non-responsive chevron.
		$toggle.on('pointerdown', function(e) {
			e.preventDefault();
			e.stopPropagation();
			// Debug log so you can see in the console when (and how) the toggle was activated.
			if (window && window.console && console.log) console.log('[sidebar-toggle] pointerdown', e.type, 'innerWidth=', window.innerWidth);

			// If on small screens, use the template's panel behavior (body.header-visible)
			if (window.innerWidth <= 960) {
				var visible = $body.hasClass('header-visible');
				if (visible) {
					// currently visible -> hide
					$body.removeClass('header-visible');
					$toggle.attr('aria-expanded', 'false');
					$toggle.attr('aria-label', 'Expand sidebar');
					$body.attr('data-sidebar-visible', 'false');
					$toggle.removeClass('open');
				} else {
					// currently hidden -> show
					$body.addClass('header-visible');
					$toggle.attr('aria-expanded', 'true');
					$toggle.attr('aria-label', 'Collapse sidebar');
					$body.attr('data-sidebar-visible', 'true');
					$toggle.addClass('open');
				}

				return;
			}

			// Desktop/tablet: use the collapsed class on the header
			var collapsed = !$header.hasClass('collapsed');
			setState(collapsed);
		});

		// Keep a no-op click handler to prevent duplicate activations on some devices/browsers
		$toggle.on('click', function(e) {
			e.preventDefault();
		});

		// Keyboard support (Space / Enter)
		$toggle.on('keydown', function(e) {
			if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
				e.preventDefault();
				$toggle.trigger('click');
			}
		});

		// Keep states in sync during window resize to avoid conflicting classes.
		// Reapply the user's mobile preference (persisted in data-sidebar-visible) when appropriate.
		$window.on('resize', function() {
				if (window.innerWidth <= 960) {
				// ensure desktop collapsed class doesn't conflict with mobile panel
				if ($header.hasClass('collapsed')) $header.removeClass('collapsed');

				// If the user previously requested the sidebar visible on mobile, reapply it.
				var pref = $body.attr('data-sidebar-visible');
				if (pref === 'true' && !$body.hasClass('header-visible')) {
					$body.addClass('header-visible');
					$toggle.attr('aria-expanded', 'true');
					$toggle.attr('aria-label', 'Collapse sidebar');
					$toggle.addClass('open');
				}
			} else {
				// ensure mobile panel class doesn't conflict with desktop layout
				// but keep the stored preference (data-sidebar-visible) intact for future small widths
				if ($body.hasClass('header-visible')) $body.removeClass('header-visible');
				// reflect desktop collapsed state on the visual toggle
				setState($header.hasClass('collapsed'));
			}
		});

		// Mutation observer: if something else removes the `header-visible` class
		// at small widths but the user preference indicates it should be visible,
		// reapply it. This helps prevent unexpected auto-collapse at intermediate
		// widths (e.g. ~510px) where other CSS/JS interactions might interfere.
		try {
			var observer = new MutationObserver(function(mutations) {
				if (window.innerWidth <= 960) {
					var pref = $body.attr('data-sidebar-visible');
					if (pref === 'true' && !$body.hasClass('header-visible')) {
						$body.addClass('header-visible');
						$toggle.attr('aria-expanded', 'true');
						$toggle.attr('aria-label', 'Collapse sidebar');
					}
				}
			});

			observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
		} catch (e) {
			// MutationObserver might not be available in very old browsers; ignore gracefully.
		}
	})();

	// Breakpoints.
		breakpoints({
			wide:      [ '961px',  '1880px' ],
			normal:    [ '961px',  '1620px' ],
			narrow:    [ '961px',  '1320px' ],
			narrower:  [ '737px',  '960px'  ],
			mobile:    [ null,     '736px'  ]
		});

	// Play initial animations on page load.
		$window.on('load', function() {
			window.setTimeout(function() {
				$body.removeClass('is-preload');
			}, 100);
		});

	// Nav.
		var $nav_a = $nav.find('a');

		$nav_a
			.addClass('scrolly')
			.on('click', function(e) {

				var $this = $(this);

				// External link? Bail.
					if ($this.attr('href').charAt(0) != '#')
						return;

				// Prevent default.
					e.preventDefault();

				// Deactivate all links.
					$nav_a.removeClass('active');

				// Activate link *and* lock it (so Scrollex doesn't try to activate other links as we're scrolling to this one's section).
					$this
						.addClass('active')
						.addClass('active-locked');

			})
			.each(function() {

				var	$this = $(this),
					id = $this.attr('href'),
					$section = $(id);

				// No section for this link? Bail.
					if ($section.length < 1)
						return;

				// Scrollex.
					$section.scrollex({
						mode: 'middle',
						top: '-10vh',
						bottom: '-10vh',
						initialize: function() {

							// Deactivate section.
								$section.addClass('inactive');

						},
						enter: function() {

							// Activate section.
								$section.removeClass('inactive');

							// No locked links? Deactivate all links and activate this section's one.
								if ($nav_a.filter('.active-locked').length == 0) {

									$nav_a.removeClass('active');
									$this.addClass('active');

								}

							// Otherwise, if this section's link is the one that's locked, unlock it.
								else if ($this.hasClass('active-locked'))
									$this.removeClass('active-locked');

						}
					});

			});

	// Scrolly.
		$('.scrolly').scrolly();

	// Header (narrower + mobile).

		// Toggle.
			$(
				'<div id="headerToggle">' +
					'<a href="#header" class="toggle"></a>' +
				'</div>'
			)
				.appendTo($body);

		// Header.
			$('#header')
				.panel({
					delay: 500,
					hideOnClick: true,
					hideOnSwipe: true,
					resetScroll: true,
					resetForms: true,
					side: 'left',
					target: $body,
					visibleClass: 'header-visible'
				});

})(jQuery);