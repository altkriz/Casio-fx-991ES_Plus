// =========================================================
// CASIO fx-991ES PLUS COMPREHENSIVE ENGINE
// =========================================================

class CasioEngine {
    constructor() {
        // UI Elements
        this.exprLine = document.getElementById('expr-line');
        this.resLine = document.getElementById('res-line');
        
        this.indShift = document.getElementById('ind-shift');
        this.indAlpha = document.getElementById('ind-alpha');
        this.indHyp = document.getElementById('ind-hyp');
        this.indDeg = document.getElementById('ind-deg');
        this.indRad = document.getElementById('ind-rad');
        this.indM = document.getElementById('ind-m');
        this.indSto = document.getElementById('ind-sto');
        this.indRcl = document.getElementById('ind-rcl');

        // Calculator State
        this.expression = '';
        this.cursorPos = 0;
        this.lastAnswer = 0;
        this.rawNumericResult = null;
        this.displayMode = 'decimal'; // 'decimal', 'fraction', 'dms'
        
        // Flags & Settings
        this.isShift = false;
        this.isAlpha = false;
        this.isHyp = false;
        this.isSto = false;
        this.isRcl = false;
        this.angleMode = 'DEG'; // 'DEG' or 'RAD'
        
        // Memory variables A, B, C, D, E, F, X, Y, M
        this.variables = {
            A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0
        };

        // Calculation History
        this.history = [];
        this.historyIndex = -1;

        this.bindEvents();
        this.updateScreen();
    }

    // --- UI Synchronizers ---
    updateIndicators() {
        this.indShift.classList.toggle('active', this.isShift);
        this.indAlpha.classList.toggle('active', this.isAlpha);
        this.indHyp.classList.toggle('active', this.isHyp);
        this.indSto.classList.toggle('active', this.isSto);
        this.indRcl.classList.toggle('active', this.isRcl);
        this.indDeg.classList.toggle('active', this.angleMode === 'DEG');
        this.indRad.classList.toggle('active', this.angleMode === 'RAD');
        this.indM.classList.toggle('active', this.variables.M !== 0);
    }

    updateScreen() {
        // Render expression with simulated cursor
        if (this.expression.length === 0) {
            this.exprLine.innerHTML = '<span class="cursor">_</span>';
        } else {
            const before = this.expression.slice(0, this.cursorPos);
            const charAt = this.expression.slice(this.cursorPos, this.cursorPos + 1) || ' ';
            const after = this.expression.slice(this.cursorPos + 1);
            this.exprLine.innerHTML = `${this.escapeHtml(before)}<u>${this.escapeHtml(charAt)}</u>${this.escapeHtml(after)}`;
        }
        this.updateIndicators();
    }

    setResult(text, rawVal = null) {
        this.resLine.textContent = text;
        this.rawNumericResult = rawVal;
    }

    escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    resetModifiers() {
        this.isShift = false;
        this.isAlpha = false;
        this.isHyp = false;
        this.isSto = false;
        this.isRcl = false;
        this.updateIndicators();
    }

    // --- Cursor & Input Manipulation ---
    insertString(str) {
        this.expression = this.expression.slice(0, this.cursorPos) + str + this.expression.slice(this.cursorPos);
        this.cursorPos += str.length;
        this.updateScreen();
    }

    deleteBack() {
        if (this.cursorPos > 0) {
            this.expression = this.expression.slice(0, this.cursorPos - 1) + this.expression.slice(this.cursorPos);
            this.cursorPos--;
            this.updateScreen();
        }
    }

    // --- Math Engine Evaluation ---
    evaluate() {
        if (!this.expression.trim()) return;

        let parsed = this.expression;

        // Auto-close open parentheses
        const openParenCount = (parsed.match(/\(/g) || []).length;
        const closeParenCount = (parsed.match(/\)/g) || []).length;
        if (openParenCount > closeParenCount) {
            parsed += ')'.repeat(openParenCount - closeParenCount);
        }

        try {
            const result = this.parseExpression(parsed);
            if (typeof result === 'number' && !isNaN(result)) {
                this.lastAnswer = result;
                this.history.push(this.expression);
                this.historyIndex = this.history.length;
                this.setResult(this.formatNumber(result), result);
            } else {
                this.setResult('Math ERROR');
            }
        } catch (e) {
            this.setResult('Syntax ERROR');
        }
    }

    parseExpression(raw) {
        let s = raw;

        // Constants
        s = s.replace(/π/g, `(${Math.PI})`);
        s = s.replace(/e(?![0-9a-zA-Z_])/g, `(${Math.E})`);
        s = s.replace(/Ans/g, `(${this.lastAnswer})`);

        // Memory Variables substitution
        for (const [key, val] of Object.entries(this.variables)) {
            const re = new RegExp(`\\b${key}\\b`, 'g');
            s = s.replace(re, `(${val})`);
        }

        // Percentage
        s = s.replace(/(\d+(\.\d+)?)%/g, '($1*0.01)');

        // Factorial n!
        s = s.replace(/(\d+)!/g, (_, n) => `this.factorial(${n})`);

        // Powers and Roots
        s = s.replace(/²/g, '**2');
        s = s.replace(/³/g, '**3');
        s = s.replace(/\^/g, '**');
        s = s.replace(/√\(/g, 'Math.sqrt(');
        s = s.replace(/∛\(/g, 'Math.cbrt(');

        // Permutation & Combination: nPr and nCr (e.g. 5P2 or 5C2)
        s = s.replace(/(\d+)\s*P\s*(\d+)/g, (_, n, r) => `this.permutations(${n}, ${r})`);
        s = s.replace(/(\d+)\s*C\s*(\d+)/g, (_, n, r) => `this.combinations(${n}, ${r})`);

        // Logarithms
        s = s.replace(/log\(/g, 'Math.log10(');
        s = s.replace(/ln\(/g, 'Math.log(');

        // Trigonometric & Inverse Trig with angle modes
        const toRad = this.angleMode === 'DEG' ? '(Math.PI/180)*' : '';
        const fromRad = this.angleMode === 'DEG' ? '*(180/Math.PI)' : '';

        s = s.replace(/sin\(/g, `Math.sin(${toRad}`);
        s = s.replace(/cos\(/g, `Math.cos(${toRad}`);
        s = s.replace(/tan\(/g, `Math.tan(${toRad}`);

        s = s.replace(/sin⁻¹\(/g, `(${fromRad}Math.asin(`);
        s = s.replace(/cos⁻¹\(/g, `(${fromRad}Math.acos(`);
        s = s.replace(/tan⁻¹\(/g, `(${fromRad}Math.atan(`);

        // Hyperbolics
        s = s.replace(/sinh\(/g, 'Math.sinh(');
        s = s.replace(/cosh\(/g, 'Math.cosh(');
        s = s.replace(/tanh\(/g, 'Math.tanh(');

        // Replace × and ÷ with JS operators
        s = s.replace(/×/g, '*').replace(/÷/g, '/');

        // Implicit multiplication: e.g. 2(3), (4)(5), 5Math.sqrt(9)
        s = s.replace(/(\d+)(\()/g, '$1*$2');
        s = s.replace(/(\))(\d+)/g, '$1*$2');
        s = s.replace(/(\))(\()/g, '$1*$2');
        s = s.replace(/(\d+)(Math\.)/g, '$1*$2');

        // Safely evaluate using Function constructor bound to this instance
        const evaluatedFn = new Function(`return (${s});`).bind(this);
        return evaluatedFn();
    }

    factorial(n) {
        if (n < 0 || n > 170 || !Number.isInteger(n)) return NaN;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }

    permutations(n, r) {
        if (n < r || n < 0 || r < 0) return NaN;
        return this.factorial(n) / this.factorial(n - r);
    }

    combinations(n, r) {
        if (n < r || n < 0 || r < 0) return NaN;
        return this.factorial(n) / (this.factorial(r) * this.factorial(n - r));
    }

    // --- S⇔D & Conversion Features ---
    toggleFractionDecimal() {
        if (this.rawNumericResult === null) return;

        if (this.displayMode === 'decimal') {
            const frac = this.toFraction(this.rawNumericResult);
            if (frac) {
                this.resLine.textContent = `${frac.num} ⌟ ${frac.den}`;
                this.displayMode = 'fraction';
            }
        } else {
            this.resLine.textContent = this.formatNumber(this.rawNumericResult);
            this.displayMode = 'decimal';
        }
    }

    toFraction(val, tolerance = 1.0e-9) {
        if (Math.abs(val - Math.round(val)) < tolerance) return { num: Math.round(val), den: 1 };
        let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
        let b = val;
        do {
            let a = Math.floor(b);
            let aux = h1; h1 = a * h1 + h2; h2 = aux;
            aux = k1; k1 = a * k1 + k2; k2 = aux;
            b = 1 / (b - a);
        } while (Math.abs(val - h1 / k1) > val * tolerance && k1 < 10000);

        return k1 <= 10000 ? { num: h1, den: k1 } : null;
    }

    convertToDms(val) {
        if (isNaN(val)) return 'Math ERROR';
        const sign = val < 0 ? '-' : '';
        const abs = Math.abs(val);
        const deg = Math.floor(abs);
        const min = Math.floor((abs - deg) * 60);
        const sec = ((abs - deg - min / 60) * 3600).toFixed(1);
        return `${sign}${deg}°${min}’${sec}”`;
    }

    formatNumber(num) {
        if (Math.abs(num) > 1e11 || (Math.abs(num) < 1e-4 && num !== 0)) {
            return num.toExponential(7).replace('e+', '×10^');
        }
        return parseFloat(num.toFixed(10)).toString();
    }

    // --- Key Actions Router ---
    handleAction(action) {
        // Variable Storage (STO)
        if (this.isSto && /^[A-FXYM]$/.test(action)) {
            this.variables[action] = this.lastAnswer;
            this.setResult(`${action} = ${this.lastAnswer}`);
            this.resetModifiers();
            return;
        }

        // Variable Recall (RCL)
        if (this.isRcl && /^[A-FXYM]$/.test(action)) {
            this.insertString(action);
            this.resetModifiers();
            return;
        }

        switch (action) {
            case 'shift':
                this.isShift = !this.isShift;
                this.isAlpha = false;
                break;
            case 'alpha':
                this.isAlpha = !this.isAlpha;
                this.isShift = false;
                break;
            case 'hyp':
                this.isHyp = !this.isHyp;
                break;
            case 'on':
            case 'ac':
                if (this.isShift && action === 'ac') {
                    // Turn off emulator effect
                    this.expression = '';
                    this.cursorPos = 0;
                    this.setResult('');
                } else {
                    this.expression = '';
                    this.cursorPos = 0;
                    this.setResult('0');
                }
                this.resetModifiers();
                break;
            case 'del':
                this.deleteBack();
                break;
            case 'equals':
                this.evaluate();
                this.resetModifiers();
                return;
            case 'mode':
                // Toggle Deg & Rad quickly
                this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
                this.resetModifiers();
                break;
            case 'sd':
                this.toggleFractionDecimal();
                break;
            case 'dms':
                if (this.rawNumericResult !== null) {
                    this.setResult(this.convertToDms(this.rawNumericResult));
                }
                break;
            case 'rcl':
                if (this.isShift) {
                    this.isSto = true;
                    this.isRcl = false;
                } else {
                    this.isRcl = true;
                    this.isSto = false;
                }
                this.updateIndicators();
                return;
            case 'mplus':
                if (this.rawNumericResult !== null) {
                    this.variables.M += this.isShift ? -this.rawNumericResult : this.rawNumericResult;
                }
                this.resetModifiers();
                break;

            // Math Function Dispatches
            case 'sqrt':
                this.insertString(this.isShift ? '∛(' : '√(');
                break;
            case 'square':
                this.insertString(this.isShift ? '³' : '²');
                break;
            case 'power':
                this.insertString(this.isShift ? '^(1/' : '^(');
                break;
            case 'inv':
                this.insertString(this.isShift ? '!' : '^(-1)');
                break;
            case 'log':
                this.insertString(this.isShift ? '10^(' : 'log(');
                break;
            case 'ln':
                this.insertString(this.isShift ? 'e^(' : 'ln(');
                break;
            case 'sin':
                this.insertString(this.isShift ? 'sin⁻¹(' : (this.isHyp ? 'sinh(' : 'sin('));
                break;
            case 'cos':
                this.insertString(this.isShift ? 'cos⁻¹(' : (this.isHyp ? 'cosh(' : 'cos('));
                break;
            case 'tan':
                this.insertString(this.isShift ? 'tan⁻¹(' : (this.isHyp ? 'tanh(' : 'tan('));
                break;
            case 'mul':
                this.insertString(this.isShift ? ' P ' : '×');
                break;
            case 'div':
                this.insertString(this.isShift ? ' C ' : '÷');
                break;
            case 'add':
                this.insertString('+');
                break;
            case 'sub':
                this.insertString('−');
                break;
            case 'ans':
                this.insertString('Ans');
                break;
            case 'exp':
                if (this.isShift) this.insertString('π');
                else if (this.isAlpha) this.insertString('e');
                else this.insertString('×10^');
                break;
            case 'lparen':
                this.insertString('(');
                break;
            case 'rparen':
                if (this.isAlpha) this.insertString('X');
                else this.insertString(')');
                break;
            case 'negate':
                this.insertString('(-');
                break;
        }

        this.resetModifiers();
        this.updateScreen();
    }

    handleNav(dir) {
        if (dir === 'left') {
            if (this.cursorPos > 0) this.cursorPos--;
        } else if (dir === 'right') {
            if (this.cursorPos < this.expression.length) this.cursorPos++;
        } else if (dir === 'up') {
            if (this.history.length > 0 && this.historyIndex > 0) {
                this.historyIndex--;
                this.expression = this.history[this.historyIndex];
                this.cursorPos = this.expression.length;
            }
        } else if (dir === 'down') {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.expression = this.history[this.historyIndex];
                this.cursorPos = this.expression.length;
            }
        }
        this.updateScreen();
    }

    bindEvents() {
        // Handle all buttons with data-action or data-val
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const val = btn.getAttribute('data-val');
                const action = btn.getAttribute('data-action');

                if (val !== null) {
                    if (this.isShift && val === '.') {
                        // Ran# generator
                        this.insertString(Math.random().toFixed(3));
                        this.resetModifiers();
                    } else {
                        this.insertString(val);
                        this.resetModifiers();
                    }
                } else if (action) {
                    this.handleAction(action);
                }
            });
        });

        // Directional Pad
        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleNav(btn.getAttribute('data-nav'));
            });
        });

        // Computer Physical Keyboard Support
        window.addEventListener('keydown', (e) => {
            if (e.key >= '0' && e.key <= '9') this.insertString(e.key);
            else if (e.key === '.') this.insertString('.');
            else if (e.key === '+') this.insertString('+');
            else if (e.key === '-') this.insertString('−');
            else if (e.key === '*') this.insertString('×');
            else if (e.key === '/') { e.preventDefault(); this.insertString('÷'); }
            else if (e.key === '(' || e.key === ')') this.insertString(e.key);
            else if (e.key === 'Backspace') this.deleteBack();
            else if (e.key === 'ArrowLeft') this.handleNav('left');
            else if (e.key === 'ArrowRight') this.handleNav('right');
            else if (e.key === 'ArrowUp') this.handleNav('up');
            else if (e.key === 'ArrowDown') this.handleNav('down');
            else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); this.evaluate(); }
            else if (e.key === 'Escape') this.handleAction('ac');
        });
    }
}

// Instantiate engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.casio = new CasioEngine();
});