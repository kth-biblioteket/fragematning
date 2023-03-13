
import { get, post, toLocalizedDateString, groupBy, logout } from './helpers.js';

const config = require('./config.json');

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/';
        this.title = `${root.title}`;
        this.menuItemText = root.title;
        this.inProcess = null;
        this.restricted = false;
    }

    async submit (button) {
        const entries = this.root.entries;

        // Nollställ sessionen. (När sessionen löper ut tvingas
        // användaren att förnya val av typ och plats.)
        this.root.session.reset();

        // Förhindra att samma fråga (av misstag) läggs till flera gånger
        // i alltför tät följd (< 2 sekunder).
        if (this.inProcess === button.dataset.qid)
            return false;
        this.inProcess = button.dataset.qid;
        setTimeout(() => this.inProcess = null, 2000);

        // Säkerställ förekomst av typ och plats explicit (webbläsarens
        // inbyggda validering är inte tydlig nog).
        if (!this.form.elements.type.value || !this.form.elements.location.value) {
            alert('Kunde inte lägga till frågan. Välj typ och plats, och försök igen!');
            return false;
        }

        if (button.dataset.req) {
            const labels = [];

            button.dataset.req.split(',').forEach(req => {
                if (!document.getElementById(req).value) {
                    const label = document.querySelector(`label[for="${req}"]`).innerText.replace(':', '').toLowerCase();
                    labels.push(label);
                }
            });

            if (labels.length) {
                alert(`Kunde inte lägga till frågan. Fyll i ${labels.length === 1 ? 'fältet' : 'fälten'} "${labels.join('", "')}" och försök igen!`);
                return false;
            }
        }

        const entry = {
            user: this.root.user,
            question: button.dataset.qid
        };

        for (const pair of new FormData(this.form)) {
            if (pair[1] && pair[0] !== 'date_type')
                entry[pair[0]] = pair[1];
        }

        if (entry.date || entry.time) {
            const date = toLocalizedDateString(new Date());
            const currentDate = date.slice(0, 10);
            const currentTime = date.slice(11, 19);
            entry.question_date = (entry.date || currentDate) + 'T' + (entry.time || currentTime);
            delete entry.date;
            delete entry.time;
        }

        return post('add', entry).then(entry => {
            ['date', 'time', 'comment'].forEach(field => {
                document.getElementById(field).value = '';
            });
            document.getElementById('last-entry')?.remove();

            const div = document.createElement('div');
            div.id = 'last-entry';
            div.innerHTML = ` 
                    Skickade in <em>${entry.description}</em> kl. ${entry.created_at.slice(11, 19)}
                    <span>
                        (${entry.type},
                        ${entry.location.toLowerCase()},
                        ${entry.question_date.slice(0, 16).replace('T', ' ')}${entry.comment ? '; kommentar: ' + entry.comment : ''})
                    </span>`;

            const undoBtn = document.createElement('button'); 
            undoBtn.innerText = 'Ångra';
            undoBtn.type = 'button';
            undoBtn.addEventListener('click', () => {
                get('undo/'+entry.id).then(() => {
                    div.style.animation = 'slide-out 0.5s';
                    entries.pop();
                });
            });
            div.appendChild(undoBtn);

            if (entries.length === 0) {
                div.classList.add('first-last-entry');
                const thanks = document.createElement('div');
                thanks.innerHTML = `<em>Tack för hjälpen ${Math.random() > 0.9 ? ':-D' : ':-)'}</em>`;
                div.appendChild(thanks);
            }

            this.questionsDiv.parentNode.insertBefore(div, this.questionsDiv);
            entries.push(entry);
            this.form.scrollIntoView();

            return true;
        });
    }

    async render () {
        this.form = document.createElement('form');
        this.form.innerHTML =
            `<div>
                <div class="form-inputs">
                    <div>
                        <label for="type">*Kanal:</label>
                        <select id="type" name="type">
                            <option></option>
                            ${ config.types.map(x => `<option>${x}</option>`).join() }
                        </select>
                    </div>
                    <div>
                        <label for="location">*Frågan gäller:</label>
                        <select id="location" name="location">
                            <option></option>
                            ${ config.locations.map(x => `<option>${x}</option>`).join() }
                        </select>
                    </div>
                    <div>
                        <label for="comment">Kommentar (valfritt):</label>
                        <textarea id="comment" name="comment" maxlength="${config.comment_maxlength || 255}"></textarea>
                    </div>
                </div>
                <div class="form-inputs">
                    <div>
                        <label>Datum/tid:</label><label><input name="date_type" type="radio" checked>Nu</label>
                        <label><input name="date_type" type="radio" value="manuellt">Manuellt</label>
                    </div>
                    <div id="manual-date" style="display: none">
                        <input id="date" name="date" type="date" max="${new Date().toISOString().slice(0, 10)}">
                        <input id="time" name="time" type="text" size="6" maxlength="5" placeholder="hh:mm" title="Tid i formatet hh:mm">
                    </div>
                </div>
            </div>
            <div id="questions"></div>`;

        const type = this.form.elements.type;
        const location = this.form.elements.location;

        type.addEventListener('change', () => {
            const unspec = 'Ospecificerat';
            const element = Array.from(location.options).find(opt => opt.innerText === unspec);

            // TODO: Bör inte vara hårdkodat.
            if (['Lånedisk', 'Ute i rummet'].includes(type.value)) {
                if (location.value === unspec) {
                    location.value = '';
                    this.root.location = null;
                }
                element.style.display = 'none';
                element.disabled = true;
            } else {
                element.disabled = false;
                element.style.removeProperty('display');
            }

            this.root.type = type.value;
        });

        location.addEventListener('change', () => {
            this.root.location = location.value;
        });

        type.value = this.root.type || this.root.URLParams.get('type') || '';
        location.value = this.root.location || this.root.URLParams.get('location') || '';
        type.dispatchEvent(new Event('change'));

        for (const radio of this.form.elements.date_type) {
            radio.addEventListener('change', () => {
                if (radio.value === 'manuellt') {
                    document.getElementById('manual-date').style.display = 'block';
                } else {
                    document.getElementById('manual-date').style.display = 'none';
                    this.form.elements.date.value = '';
                    this.form.elements.time.value = '';
                }
            });
        }

        const time = this.form.elements.time;
        time.addEventListener('blur', () => {
            if (!time.value)
                return true;

            const matches = time.value.match(/(\d+)\D+(\d+)/);
            if (matches) {
                const h = parseInt(matches[1]);
                const m = parseInt(matches[2]);
                if (h >= 6 && h <= 23 && m >= 0 && m <= 59) {
                    time.value = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
                    return true;
                }
            }

            alert('Ange giltig tid mellan 06-23 i formatet hh:mm');
            time.value = '';
            time.focus();
            return false;
        });

        this.questionsDiv = this.form.querySelector('#questions');

        get('questions?user=' + this.root.user).then(questions => {
            groupBy(questions, 'category').forEach(group => {
                const div = document.createElement('div');
                const info = document.getElementById('info');
                div.innerHTML = `<h2>${group.category}</h2>`;

                group.rows
                    .forEach(q => {
                        const button = document.createElement('button');
                        button.dataset.qid = q.id;
                        button.type = 'button';
                        button.innerHTML = q.description;

                        // Lite hårdkodat.
                        const requiresComment = q.requires?.split(',')?.includes('comment');

                        if (q.info || requiresComment) {
                            button.addEventListener('mouseover', () => {
                                info.innerHTML = q.info;
                                if (requiresComment)
                                    info.innerHTML += (q.info ? ' &mdash; ' : '') + ' <i>kommentar obligatorisk</i>';
                                info.style.top = button.offsetTop  + 'px';
                                info.style.left = (button.offsetLeft + button.offsetWidth) + 'px';
                                info.style.display = 'block'
                            });
                            button.addEventListener('mouseout', () => info.style.display = 'none');
                        }

                        if (q.requires) {
                            button.dataset.req = q.requires;
                            if (requiresComment)
                                button.innerHTML += ' *';
                        }

                        button.addEventListener('click', () => {
                            this.submit(button).then(sent => {
                                if (sent)
                                    button.classList.add('button-animation');
                            });
                        });

                        div.appendChild(button);
                    });

                this.questionsDiv.appendChild(div);
            });

        });

        return this.form;
    }
}
