 class CasioSuperEngine {
        constructor() {
            // UI elements
            this.exprElem = document.getElementById('expr-display');
            this.resElem = document.getElementById('res-display');
            this.menuOverlay = document.getElementById('menu-overlay');
            
            // LCD Flags
            this.flags = {
                S: document.getElementById('flag-s'),
                A: document.getElementById('flag-a'),
                M: document.getElementById('flag-m'),
                STO: document.getElementById('flag-sto'),
                RCL: document.getElementById('flag-rcl'),
                HYP: document.getElementById('flag-hyp'),
                D: document.getElementById('flag-deg'),
                R: document.getElementById('flag-rad'),
                G: document.getElementById('flag-gra')
            };

            // Audio Context for tactile feedback click
            this.audioCtx = null;

            // Internal State
            this.expr = '';
            this.cursor = 0;
            this.lastAnswer = 0;
            this.currentResult = null;
            this.sdState = 0; // 0: decimal/default, 1: fraction, 2: DMS
            
            this.isShift = false;
            this.isAlpha = false;
            this.isHyp = false;
            this.isSto = false;
            this.isRcl = false;
            this.angleMode = 'DEG'; // DEG, RAD, GRA
            this.inMenu = false;
            
            // Memory registers
            this.vars = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 };

            // History Stack
            this.history = [];
            this.histIdx = -1;

            this.initAudio();
            this.bindEvents();
            this.render();
        }

        initAudio() {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.audioCtx = new AudioCtx();
            } catch(e){}
        }

        playClick() {
            if (!this.audioCtx) return;
            try {
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(320, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.02);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.02);
            } catch(e){}
        }

        // --- Render LCD ---
        render() {
            // Update Flags
            this.flags.S.classList.toggle('on', this.isShift);
            this.flags.A.classList.toggle('on', this.isAlpha);
            this.flags.HYP.classList.toggle('on', this.isHyp);
            this.flags.STO.classList.toggle('on', this.isSto);
            this.flags.RCL.classList.toggle('on', this.isRcl);
            this.flags.M.classList.toggle('on', this.vars.M !== 0);
            this.flags.D.classList.toggle('on', this.angleMode === 'DEG');
            this.flags.R.classList.toggle('on', this.angleMode === 'RAD');
            this.flags.G.classList.toggle('on', this.angleMode === 'GRA');

            // Render Expression with Blinking Cursor
            if (this.expr.length === 0) {
                this.exprElem.innerHTML = '<span class="cursor">_</span>';
            } else {
                const left = this.escape(this.expr.slice(0, this.cursor));
                const char = this.escape(this.expr.slice(this.cursor, this.cursor + 1) || ' ');
                const right = this.escape(this.expr.slice(this.cursor + 1));
                this.exprElem.innerHTML = `${left}<span class="cursor">${char}</span>${right}`;
            }
        }

        escape(s) {
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        setResult(val, raw = null) {
            this.resElem.textContent = val;
            this.currentResult = raw !== null ? raw : parseFloat(val);
            this.sdState = 0;
        }

        // --- Text Editing & Cursor Operations ---
        insert(str) {
            this.expr = this.expr.slice(0, this.cursor) + str + this.expr.slice(this.cursor);
            this.cursor += str.length;
            this.render();
        }

        backspace() {
            if (this.cursor > 0) {
                this.expr = this.expr.slice(0, this.cursor - 1) + this.expr.slice(this.cursor);
                this.cursor--;
                this.render();
            }
        }

        resetModifiers() {
            this.isShift = false;
            this.isAlpha = false;
            this.isHyp = false;
            this.isSto = false;
            this.isRcl = false;
            this.render();
        }

        // --- Scientific Computations & Parsing ---
        toFraction(val, maxDen = 5000) {
            if (isNaN(val) || !isFinite(val)) return null;
            if (Math.abs(val - Math.round(val)) < 1e-9) return { n: Math.round(val), d: 1 };
            
            const sign = val < 0 ? -1 : 1;
            val = Math.abs(val);
            let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
            let b = val;
            do {
                let a = Math.floor(b);
                let aux = h1; h1 = a * h1 + h2; h2 = aux;
                aux = k1; k1 = a * k1 + k2; k2 = aux;
                b = 1 / (b - a);
            } while (Math.abs(val - h1 / k1) > val * 1e-9 && k1 < maxDen);

            return k1 <= maxDen ? { n: sign * h1, d: k1 } : null;
        }

        toDMS(val) {
            if (isNaN(val)) return 'Math ERROR';
            const sign = val < 0 ? '-' : '';
            const abs = Math.abs(val);
            const d = Math.floor(abs);
            const m = Math.floor((abs - d) * 60);
            const s = ((abs - d - m / 60) * 3600).toFixed(1);
            return `${sign}${d}°${m}’${s}”`;
        }

        formatNumber(num) {
            if (isNaN(num) || !isFinite(num)) return 'Math ERROR';
            if (Math.abs(num) >= 1e10 || (Math.abs(num) < 1e-4 && num !== 0)) {
                return num.toExponential(6).replace('e+', '×10^').replace('e', '×10^');
            }
            return parseFloat(num.toFixed(10)).toString();
        }

        factorial(n) {
            if (n < 0 || n > 170 || !Number.isInteger(n)) return NaN;
            let r = 1;
            for (let i = 2; i <= n; i++) r *= i;
            return r;
        }

        nPr(n, r) {
            if (n < r || n < 0 || r < 0) return NaN;
            return this.factorial(n) / this.factorial(n - r);
        }

        nCr(n, r) {
            if (n < r || n < 0 || r < 0) return NaN;
            return this.factorial(n) / (this.factorial(r) * this.factorial(n - r));
        }

        // Numerical Derivative: d/dx(f(x), atX)
        evalDerivative(funcStr, atX) {
            const h = 1e-6;
            const y2 = this.evalSubFunc(funcStr, atX + h);
            const y1 = this.evalSubFunc(funcStr, atX - h);
            return (y2 - y1) / (2 * h);
        }

        // Numerical Integration: ∫(f(x), a, b) via Simpson's 1/3 rule
        evalIntegral(funcStr, a, b) {
            const n = 60; // subdivisions
            const h = (b - a) / n;
            let sum = this.evalSubFunc(funcStr, a) + this.evalSubFunc(funcStr, b);
            for (let i = 1; i < n; i++) {
                const x = a + i * h;
                sum += this.evalSubFunc(funcStr, x) * (i % 2 === 0 ? 2 : 4);
            }
            return (h / 3) * sum;
        }

        // Evaluate user function with an assigned value for variable X
        evalSubFunc(funcExpr, xVal) {
            const oldX = this.vars.X;
            this.vars.X = xVal;
            const res = this.solveParsed(funcExpr);
            this.vars.X = oldX;
            return res;
        }

        // Central Math Parser
        solveParsed(inputStr) {
            let s = inputStr;

            // Handle d/dx(func, x)
            s = s.replace(/d\/dx\((.+?),([^)]+)\)/g, (_, f, xVal) => {
                const v = this.solveParsed(xVal);
                return `(${this.evalDerivative(f, v)})`;
            });

            // Handle ∫(func, a, b)
            s = s.replace(/∫\((.+?),([^,]+),([^)]+)\)/g, (_, f, aVal, bVal) => {
                const a = this.solveParsed(aVal);
                const b = this.solveParsed(bVal);
                return `(${this.evalIntegral(f, a, b)})`;
            });

            // Constants
            s = s.replace(/π/g, `(${Math.PI})`);
            s = s.replace(/e(?![a-zA-Z0-9_])/g, `(${Math.E})`);
            s = s.replace(/Ans/g, `(${this.lastAnswer})`);

            // Variables substitution
            for (const [k, v] of Object.entries(this.vars)) {
                const re = new RegExp(`\\b${k}\\b`, 'g');
                s = s.replace(re, `(${v})`);
            }

            // Factorial (n!)
            s = s.replace(/(\d+)!/g, (_, n) => `this.factorial(${n})`);

            // Permutations & Combinations (e.g. 5 P 2 or 5 C 2)
            s = s.replace(/(\d+)\s*P\s*(\d+)/g, (_, n, r) => `this.nPr(${n},${r})`);
            s = s.replace(/(\d+)\s*C\s*(\d+)/g, (_, n, r) => `this.nCr(${n},${r})`);

            // Powers & Roots
            s = s.replace(/²/g, '**2');
            s = s.replace(/³/g, '**3');
            s = s.replace(/\^/g, '**');
            s = s.replace(/√\(/g, 'Math.sqrt(');
            s = s.replace(/∛\(/g, 'Math.cbrt(');

            // Angle Conversions for Trig
            let toRad = '1';
            let fromRad = '1';
            if (this.angleMode === 'DEG') {
                toRad = '(Math.PI/180)';
                fromRad = '(180/Math.PI)';
            } else if (this.angleMode === 'GRA') {
                toRad = '(Math.PI/200)';
                fromRad = '(200/Math.PI)';
            }

            // Standard Trig & Inverses
            s = s.replace(/sin\(/g, `Math.sin(${toRad}*`);
            s = s.replace(/cos\(/g, `Math.cos(${toRad}*`);
            s = s.replace(/tan\(/g, `Math.tan(${toRad}*`);
            s = s.replace(/sin⁻¹\(/g, `(${fromRad}*Math.asin(`);
            s = s.replace(/cos⁻¹\(/g, `(${fromRad}*Math.acos(`);
            s = s.replace(/tan⁻¹\(/g, `(${fromRad}*Math.atan(`);

            // Hyperbolics
            s = s.replace(/sinh\(/g, 'Math.sinh(');
            s = s.replace(/cosh\(/g, 'Math.cosh(');
            s = s.replace(/tanh\(/g, 'Math.tanh(');

            // Logarithms
            s = s.replace(/log\(/g, 'Math.log10(');
            s = s.replace(/ln\(/g, 'Math.log(');
            // Custom base log(base, value) -> Math.log(val)/Math.log(base)
            s = s.replace(/log_b\(([^,]+),([^)]+)\)/g, '(Math.log($2)/Math.log($1))');

            // Replace display symbols
            s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

            // Implicit multiplication: 2(3), (2)(3), 4π, 3sin(x)
            s = s.replace(/(\d+)(\()/g, '$1*$2');
            s = s.replace(/(\))(\d+)/g, '$1*$2');
            s = s.replace(/(\))(\()/g, '$1*$2');
            s = s.replace(/(\d+)(Math\.)/g, '$1*$2');

            // Execute safely
            const fn = new Function(`return (${s});`).bind(this);
            return fn();
        }

        evaluate() {
            if (!this.expr.trim()) return;

            // Auto-close missing parentheses
            let openP = (this.expr.match(/\(/g) || []).length;
            let closeP = (this.expr.match(/\)/g) || []).length;
            if (openP > closeP) {
                this.expr += ')'.repeat(openP - closeP);
            }

            try {
                const res = this.solveParsed(this.expr);
                if (typeof res === 'number' && !isNaN(res)) {
                    this.lastAnswer = res;
                    this.history.push(this.expr);
                    this.histIdx = this.history.length;
                    
                    // Show formatted result
                    this.setResult(this.formatNumber(res), res);
                } else {
                    this.setResult('Math ERROR', null);
                }
            } catch (err) {
                this.setResult('Syntax ERROR', null);
            }
        }

        // --- Action Router ---
        handleKey(key) {
            this.playClick();

            // Menu interactions
            if (this.inMenu) {
                if (key === '1') { this.angleMode = 'DEG'; }
                if (key === '2') { this.angleMode = 'RAD'; }
                if (key === '3') { this.angleMode = 'GRA'; }
                this.menuOverlay.style.display = 'none';
                this.inMenu = false;
                this.render();
                return;
            }

            // STO (Store to variable)
            if (this.isSto && /^[A-FXYM]$/.test(key)) {
                this.vars[key] = this.currentResult !== null ? this.currentResult : this.lastAnswer;
                this.setResult(`${key} = ${this.vars[key]}`, this.vars[key]);
                this.resetModifiers();
                return;
            }

            // RCL (Recall variable value into expression)
            if (this.isRcl && /^[A-FXYM]$/.test(key)) {
                this.insert(this.vars[key].toString());
                this.resetModifiers();
                return;
            }

            // Modifier Keys
            if (key === 'SHIFT') {
                this.isShift = !this.isShift;
                this.isAlpha = false;
                this.render();
                return;
            }
            if (key === 'ALPHA') {
                this.isAlpha = !this.isAlpha;
                this.isShift = false;
                this.render();
                return;
            }
            if (key === 'HYP') {
                this.isHyp = !this.isHyp;
                this.render();
                return;
            }

            // ON / AC / Clear
            if (key === 'ON' || key === 'AC') {
                if (this.isShift && key === 'AC') {
                    // Turn off calculator effect
                    this.expr = '';
                    this.cursor = 0;
                    this.resElem.textContent = '';
                } else {
                    this.expr = '';
                    this.cursor = 0;
                    this.resElem.textContent = '0';
                    this.currentResult = 0;
                }
                this.resetModifiers();
                return;
            }

            // Delete (DEL / INS)
            if (key === 'DEL') {
                this.backspace();
                this.resetModifiers();
                return;
            }

            // Equals / Evaluation
            if (key === 'EXE') {
                this.evaluate();
                this.resetModifiers();
                return;
            }

            // MODE / SETUP Menu
            if (key === 'MODE') {
                if (this.isShift) {
                    // Toggle angle modes quickly
                    this.angleMode = this.angleMode === 'DEG' ? 'RAD' : (this.angleMode === 'RAD' ? 'GRA' : 'DEG');
                } else {
                    this.inMenu = true;
                    this.menuOverlay.style.display = 'flex';
                }
                this.resetModifiers();
                return;
            }

            // S<=>D Display Mode Switcher (Fraction <-> Decimal <-> DMS)
            if (key === 'SD') {
                if (this.currentResult !== null) {
                    if (this.sdState === 0) {
                        const frac = this.toFraction(this.currentResult);
                        if (frac && frac.d > 1) {
                            this.resElem.textContent = `${frac.n} ⌟ ${frac.d}`;
                            this.sdState = 1;
                        } else {
                            this.resElem.textContent = this.toDMS(this.currentResult);
                            this.sdState = 2;
                        }
                    } else if (this.sdState === 1) {
                        this.resElem.textContent = this.toDMS(this.currentResult);
                        this.sdState = 2;
                    } else {
                        this.resElem.textContent = this.formatNumber(this.currentResult);
                        this.sdState = 0;
                    }
                }
                this.resetModifiers();
                return;
            }

            // DMS conversion directly
            if (key === 'DMS') {
                if (this.currentResult !== null) {
                    this.resElem.textContent = this.toDMS(this.currentResult);
                    this.sdState = 2;
                }
                this.resetModifiers();
                return;
            }

            // ENG (Engineering exponent shift)
            if (key === 'ENG') {
                if (this.currentResult !== null) {
                    const e = this.isShift ? 3 : -3;
                    this.currentResult = this.currentResult * Math.pow(10, e);
                    this.resElem.textContent = this.formatNumber(this.currentResult);
                }
                this.resetModifiers();
                return;
            }

            // RCL & STO toggling
            if (key === 'RCL') {
                if (this.isShift) {
                    this.isSto = true;
                    this.isRcl = false;
                } else {
                    this.isRcl = true;
                    this.isSto = false;
                }
                this.render();
                return;
            }

            // Memory M+ / M-
            if (key === 'M_PLUS') {
                const cur = this.currentResult !== null ? this.currentResult : this.lastAnswer;
                if (this.isShift) {
                    this.vars.M -= cur;
                } else {
                    this.vars.M += cur;
                }
                this.resetModifiers();
                return;
            }

            // CALC / SOLVE
            if (key === 'CALC') {
                if (this.isShift) {
                    // SOLVE: Secant root finder for equation = 0 with variable X
                    let x0 = this.vars.X || 0.1;
                    let x1 = x0 + 0.01;
                    for (let i = 0; i < 30; i++) {
                        let y0 = this.evalSubFunc(this.expr, x0);
                        let y1 = this.evalSubFunc(this.expr, x1);
                        if (Math.abs(y1) < 1e-8) break;
                        let dx = (y1 * (x1 - x0)) / (y1 - y0);
                        x0 = x1;
                        x1 -= dx;
                    }
                    this.vars.X = x1;
                    this.setResult(`X = ${this.formatNumber(x1)}`, x1);
                } else {
                    // CALC: Evaluate current expression with preset variables
                    this.evaluate();
                }
                this.resetModifiers();
                return;
            }

            // Math Function Tokens
            let tok = null;

            if (this.isAlpha) {
                // ALPHA variables A, B, C, D, E, F, X, Y, M
                const alphaKeys = {
                    'INV': 'A', 'LOGAB': 'B', 'FRAC': 'C', 'SQRT': 'D',
                    'SQR': 'E', 'POW': 'F', 'LOG': 'X', 'LN': 'Y',
                    'M_PLUS': 'M', ')': 'X', 'EXP': 'e', 'DOT': 'RanInt('
                };
                if (alphaKeys[key]) tok = alphaKeys[key];
            } else if (this.isShift) {
                // SHIFT yellow secondary mappings
                const shiftKeys = {
                    'INTG': 'd/dx(', 'INV': '!', 'LOGAB': 'Σ(',
                    'FRAC': 'Mixed(', 'SQRT': '∛(', 'SQR': '³',
                    'POW': '^(', 'LOG': '10^(', 'LN': 'e^(',
                    'SIN': 'sin⁻¹(', 'COS': 'cos⁻¹(', 'TAN': 'tan⁻¹(',
                    'MUL': ' P ', 'DIV': ' C ', 'ADD': 'Pol(', 'SUB': 'Rec(',
                    'EXP': 'π', 'DOT': Math.random().toFixed(3), 'ANS': '%'
                };
                if (shiftKeys[key]) tok = shiftKeys[key];
            }

            // Default Primary Key Mappings
            if (tok === null) {
                switch (key) {
                    case 'INTG': tok = '∫('; break;
                    case 'INV': tok = '^(-1)'; break;
                    case 'LOGAB': tok = 'log_b('; break;
                    case 'FRAC': tok = '/'; break;
                    case 'SQRT': tok = '√('; break;
                    case 'SQR': tok = '²'; break;
                    case 'POW': tok = '^('; break;
                    case 'LOG': tok = 'log('; break;
                    case 'LN': tok = 'ln('; break;
                    case 'NEG': tok = '(-'; break;
                    case 'SIN': tok = this.isHyp ? 'sinh(' : 'sin('; break;
                    case 'COS': tok = this.isHyp ? 'cosh(' : 'cos('; break;
                    case 'TAN': tok = this.isHyp ? 'tanh(' : 'tan('; break;
                    case '(': tok = '('; break;
                    case ')': tok = ')'; break;
                    case 'MUL': tok = '×'; break;
                    case 'DIV': tok = '÷'; break;
                    case 'ADD': tok = '+'; break;
                    case 'SUB': tok = '−'; break;
                    case 'DOT': tok = '.'; break;
                    case 'EXP': tok = '×10^'; break;
                    case 'ANS': tok = 'Ans'; break;
                    case 'CONST': tok = '299792458'; break; // Speed of light
                    case 'CONV': tok = '*(1.602176634e-19)'; break;
                    default:
                        if (/^[0-9]$/.test(key)) tok = key;
                }
            }

            if (tok) this.insert(tok);
            this.resetModifiers();
        }

        // D-Pad Cursor Navigation and History
        handleNav(dir) {
            this.playClick();
            if (dir === 'LF') {
                if (this.cursor > 0) this.cursor--;
            } else if (dir === 'RT') {
                if (this.cursor < this.expr.length) this.cursor++;
            } else if (dir === 'UP') {
                if (this.history.length > 0 && this.histIdx > 0) {
                    this.histIdx--;
                    this.expr = this.history[this.histIdx];
                    this.cursor = this.expr.length;
                }
            } else if (dir === 'DN') {
                if (this.histIdx < this.history.length - 1) {
                    this.histIdx++;
                    this.expr = this.history[this.histIdx];
                    this.cursor = this.expr.length;
                }
            }
            this.render();
        }

        bindEvents() {
            // Calculator Keys
            document.querySelectorAll('.k').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleKey(btn.getAttribute('data-k'));
                });
            });

            // Replay D-Pad Arrows
            document.querySelectorAll('.arrow-key').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleNav(btn.getAttribute('data-dir'));
                });
            });

            // Physical Keyboard support
            window.addEventListener('keydown', (e) => {
                if (e.key >= '0' && e.key <= '9') this.handleKey(e.key);
                else if (e.key === '.') this.handleKey('DOT');
                else if (e.key === '+') this.handleKey('ADD');
                else if (e.key === '-') this.handleKey('SUB');
                else if (e.key === '*') this.handleKey('MUL');
                else if (e.key === '/') { e.preventDefault(); this.handleKey('DIV'); }
                else if (e.key === '(') this.handleKey('(');
                else if (e.key === ')') this.handleKey(')');
                else if (e.key === '^') this.handleKey('POW');
                else if (e.key === 'Backspace') this.handleKey('DEL');
                else if (e.key === 'Escape') this.handleKey('AC');
                else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); this.handleKey('EXE'); }
                else if (e.key === 'ArrowLeft') this.handleNav('LF');
                else if (e.key === 'ArrowRight') this.handleNav('RT');
                else if (e.key === 'ArrowUp') this.handleNav('UP');
                else if (e.key === 'ArrowDown') this.handleNav('DN');
            });
        }
    }

    // Start engine when document loads
    document.addEventListener('DOMContentLoaded', () => {
        window.casioEngine = new CasioSuperEngine();
    });