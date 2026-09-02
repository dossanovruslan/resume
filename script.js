(function () {
    'use strict';

    /* Theme toggle */
    var root = document.documentElement;
    var themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', next);
            try {
                localStorage.setItem('theme', next);
            } catch (e) {}
        });
    }

    /* Scroll-spy navigation */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
    var sections = navLinks
        .map(function (link) {
            return document.getElementById(link.dataset.section);
        })
        .filter(Boolean);

    if (sections.length && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var id = entry.target.id;
                    navLinks.forEach(function (link) {
                        link.classList.toggle('active', link.dataset.section === id);
                    });
                });
            },
            { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
        );
        sections.forEach(function (section) {
            observer.observe(section);
        });
    }

    /* Portfolio filters */
    var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.filter-btn'));
    var portfolioItems = Array.prototype.slice.call(document.querySelectorAll('.portfolio-item'));

    filterButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            var filter = button.dataset.filter;

            filterButtons.forEach(function (btn) {
                btn.classList.toggle('active', btn === button);
            });

            portfolioItems.forEach(function (item) {
                var match = filter === 'all' || item.dataset.category === filter;
                item.classList.toggle('is-hidden', !match);
            });
        });
    });

    /* Interactive dot-grid background with mouse trail */
    var canvas = document.getElementById('dot-canvas');
    if (canvas && canvas.getContext) {
        var ctx = canvas.getContext('2d');
        var offscreen = document.createElement('canvas');
        var offCtx = offscreen.getContext('2d');

        var SPACING = 18;
        var DOT_SIZE = 2;
        var TRAIL_SIZE = 5;
        var TRAIL_RADIUS = 1;
        var FADE_MS = 900;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);

        var width = 0;
        var height = 0;
        var cols = 0;
        var rows = 0;
        var active = new Map();

        function readColors() {
            var styles = getComputedStyle(root);
            return {
                dot: styles.getPropertyValue('--color-dot').trim(),
                accent: styles.getPropertyValue('--color-accent').trim()
            };
        }

        function drawBase() {
            offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            offCtx.clearRect(0, 0, width, height);
            offCtx.fillStyle = readColors().dot;
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    offCtx.fillRect(c * SPACING, r * SPACING, DOT_SIZE, DOT_SIZE);
                }
            }
        }

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            cols = Math.ceil(width / SPACING) + 1;
            rows = Math.ceil(height / SPACING) + 1;

            [canvas, offscreen].forEach(function (c) {
                c.width = Math.round(width * dpr);
                c.height = Math.round(height * dpr);
                c.style.width = width + 'px';
                c.style.height = height + 'px';
            });

            drawBase();
        }

        function activateNear(x, y) {
            var centerCol = Math.round(x / SPACING);
            var centerRow = Math.round(y / SPACING);
            var now = performance.now();

            for (var dr = -TRAIL_RADIUS; dr <= TRAIL_RADIUS; dr++) {
                for (var dc = -TRAIL_RADIUS; dc <= TRAIL_RADIUS; dc++) {
                    var dist = Math.sqrt(dr * dr + dc * dc);
                    if (dist > TRAIL_RADIUS + 0.4) continue;
                    var peak = Math.max(0.4, 1 - dist / (TRAIL_RADIUS + 1));
                    var key = (centerCol + dc) + ',' + (centerRow + dr);
                    var existing = active.get(key);
                    if (!existing || existing.peak <= peak) {
                        active.set(key, { ts: now, peak: peak });
                    }
                }
            }
        }

        window.addEventListener('mousemove', function (e) {
            activateNear(e.clientX, e.clientY);
        }, { passive: true });

        window.addEventListener('touchmove', function (e) {
            var touch = e.touches[0];
            if (touch) activateNear(touch.clientX, touch.clientY);
        }, { passive: true });

        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 150);
        });

        if (themeToggle) {
            themeToggle.addEventListener('click', function () {
                requestAnimationFrame(drawBase);
            });
        }

        function frame(now) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offscreen, 0, 0);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var accent = readColors().accent;
            active.forEach(function (entry, key) {
                var age = now - entry.ts;
                if (age > FADE_MS) {
                    active.delete(key);
                    return;
                }
                var parts = key.split(',');
                var col = parseInt(parts[0], 10);
                var row = parseInt(parts[1], 10);
                var opacity = (1 - age / FADE_MS) * entry.peak;
                ctx.globalAlpha = opacity;
                ctx.fillStyle = accent;
                ctx.fillRect(col * SPACING - TRAIL_SIZE / 2, row * SPACING - TRAIL_SIZE / 2, TRAIL_SIZE, TRAIL_SIZE);
            });
            ctx.globalAlpha = 1;

            requestAnimationFrame(frame);
        }

        resize();
        requestAnimationFrame(frame);
    }
})();
