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

    /* PDF export */
    var pdfButton = document.getElementById('pdf-export-btn');

    if (pdfButton) {
        var pdfLabel = pdfButton.querySelector('.footer-pdf-btn-label');
        var pdfLabelDefault = pdfLabel ? pdfLabel.textContent : '';

        function waitForImages(container) {
            var images = Array.prototype.slice.call(container.querySelectorAll('img'));
            return Promise.all(images.map(function (img) {
                if (img.loading === 'lazy') img.loading = 'eager';
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise(function (resolve) {
                    var done = function () { resolve(); };
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                    setTimeout(done, 5000);
                });
            }));
        }

        /* html2canvas can't resolve <use href="#icon-x"> against <symbol> defs
           reliably, so swap icons to inline paths before capture and restore after. */
        function inlineIcons(container) {
            var svgs = Array.prototype.slice.call(container.querySelectorAll('svg.icon'));
            var restore = [];
            svgs.forEach(function (svg) {
                var use = svg.querySelector('use');
                if (!use) return;
                var href = use.getAttribute('href') || use.getAttribute('xlink:href');
                if (!href || href.charAt(0) !== '#') return;
                var symbol = document.querySelector(href);
                if (!symbol) return;
                restore.push({ svg: svg, html: svg.innerHTML, viewBox: svg.getAttribute('viewBox') });
                svg.innerHTML = symbol.innerHTML;
                if (symbol.getAttribute('viewBox')) svg.setAttribute('viewBox', symbol.getAttribute('viewBox'));
            });
            return restore;
        }

        function restoreIcons(restore) {
            restore.forEach(function (item) {
                item.svg.innerHTML = item.html;
                if (item.viewBox) item.svg.setAttribute('viewBox', item.viewBox);
            });
        }

        pdfButton.addEventListener('click', function () {
            if (pdfButton.disabled) return;
            if (typeof html2canvas === 'undefined' || !window.jspdf) {
                window.print();
                return;
            }

            var target = document.querySelector('main');
            if (!target) return;

            pdfButton.disabled = true;
            if (pdfLabel) pdfLabel.textContent = 'Формирую PDF…';

            var iconRestore = [];

            waitForImages(target)
                .then(function () {
                    iconRestore = inlineIcons(target);
                    var bg = getComputedStyle(document.body).backgroundColor;
                    return html2canvas(target, {
                        scale: Math.min(window.devicePixelRatio || 1, 2),
                        useCORS: true,
                        backgroundColor: bg
                    });
                })
                .then(function (canvas) {
                    restoreIcons(iconRestore);
                    var jsPDF = window.jspdf.jsPDF;
                    var pdf = new jsPDF('p', 'pt', 'a4');
                    var pdfWidth = pdf.internal.pageSize.getWidth();
                    var pdfHeight = pdf.internal.pageSize.getHeight();
                    var imgWidth = pdfWidth;
                    var imgHeight = (canvas.height * imgWidth) / canvas.width;
                    var imgData = canvas.toDataURL('image/jpeg', 0.92);

                    var heightLeft = imgHeight;
                    var position = 0;

                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;

                    while (heightLeft > 0) {
                        position = heightLeft - imgHeight;
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                        heightLeft -= pdfHeight;
                    }

                    pdf.save('Dosanov_Ruslan_Resume.pdf');
                })
                .catch(function (err) {
                    restoreIcons(iconRestore);
                    console.error('PDF export failed', err);
                    window.print();
                })
                .finally(function () {
                    pdfButton.disabled = false;
                    if (pdfLabel) pdfLabel.textContent = pdfLabelDefault;
                });
        });
    }

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
