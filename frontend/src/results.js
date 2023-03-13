
// Babel hanterar inte ResizeObserver (som används av Chart.js).
import { install } from 'resize-observer';
if (!window.ResizeObserver) install();

import { get, countBy, groupBy, percentage, createTable, logout } from './helpers.js';

import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    DoughnutController,
    Legend,
    LinearScale,
    Tooltip
} from 'chart.js';

Chart.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    Legend,
    LinearScale,
    Tooltip
);

Chart.defaults.font.size = 14;

const config = require('./config.json');
const colors7 = ['#333333', '#FFA600', '#FF6E54', '#DD5182', '#955196', '#444E86', '#003F5C'];

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/results';
        this.title = 'Resultat';
    }

    addTable () {
        const div = createTable(...arguments);
        div.classList.add('results-table');
        this.results.appendChild(div);
    }

    addChart (title, chart) {
        const div = document.createElement('div');
        const canvas = document.createElement('canvas');

        div.innerHTML = `<h2>${title}</h2>`;
        div.classList.add('chart');
        div.classList.add('chart-' + chart.type);
        div.appendChild(canvas)
        this.results.appendChild(div);

        chart.options = Object.assign({
            layout: {
                padding: 20
            },
            plugins: {},
            aspectRatio: 1
        }, chart.options);

        chart.options.plugins.tooltip = {
            callbacks: {
                label: tooltipItem => {
                    const value = chart.data.datasets[0].data[tooltipItem.dataIndex];
                    const sum = chart.data.datasets[0].data.reduce((acc, cur) => acc += cur, 0);
                    return ` ${percentage(value, sum)}% (${value} st)`;
                },
                title: tooltipItems => {
                    return tooltipItems[0].label;
                }
            }
        }

        if (chart.type === 'bar') {
            chart.options.plugins.legend = { display: false };

            chart.data.datasets = chart.data.datasets.map(ds =>
                Object.assign({
                    backgroundColor: '#666',
                }, ds)
            );
        } else if (chart.type === 'doughnut') {
            chart.options.layout.padding = 5;

            chart.data.datasets = chart.data.datasets.map(ds =>
                Object.assign({
                    backgroundColor: colors7,
                }, ds)
            );
        }

        return new Chart(canvas, chart);
    }

    getFilters () {
        const conditions = [];

        for (const pair of new FormData(this.form)) {
            if (pair[1]) {
                if (pair[0] === 'from_date') {
                    conditions.push('date>=' + pair[1] + 'T00:00:00');
                } else if (pair[0] === 'to_date') {
                    conditions.push('date<=' + pair[1] + 'T23:59:59');
                } else if (pair[0] === 'from_hour') {
                    conditions.push('hour>=' + pair[1]);
                } else if (pair[0] === 'to_hour') {
                    conditions.push('hour<=' + pair[1]);
                } else if (pair[0] === 'comment') {
                    conditions.push('comment<>NULL');
                } else {
                    conditions.push(pair[0] + '=' + pair[1]);
                }
            }
        }

        return conditions.length
            ? 'where=' + encodeURIComponent(conditions.join(';'))
            : null;
    }

    async update (queryString = this.getFilters()) {
        this.results.innerHTML = '';

        const entries = await get('entries' + (queryString ? '?' + queryString : ''));

        if (!entries.length) {
            this.results.innerHTML = '<p>Inga data för urvalet.</p>';
            return false;
        }

        {
            const counts = countBy(entries, 'hour');
            const values = new Array(24).fill(0);
            const labels = Array.from(values.keys());
            Object.entries(counts).forEach(e => values[e[0]] = e[1]);

            while (!values[0]) {
                values.shift();
                labels.shift();
            }
            while (!values[values.length - 1]) {
                values.pop();
                labels.pop();
            }

            this.addChart('Timma', {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ data: values }]
                },
            });
        }
        {
            const counts = countBy(entries, 'weekday');
            const values = new Array(7).fill(0);
            const labels = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
            Object.entries(counts).forEach(e => values[e[0]] = e[1]);

            this.addChart('Veckodag', {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ data: values }]
                },
            });
        }
        {
            const counts = countBy(entries, 'week');
            const values = new Array(53).fill(0);
            Object.entries(counts).forEach(e => values[e[0]-1] = e[1]);

            this.addChart('Vecka', {
                type: 'bar',
                data: {
                    labels: values.map((v, i) => i+1),
                    datasets: [{ data: values }]
                }
            });
        }
        {
            const counts = countBy(entries, 'year');
            this.addChart('År', {
                type: 'bar',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{ data: Object.values(counts) }]
                }
            });
        }
        {
            const counts = countBy(entries, 'type');
            this.addChart('Typ', {
                type: 'doughnut',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{ data: Object.values(counts) }]
                }
            });
        }
        {
            const counts = countBy(entries, 'location');
            this.addChart('Plats', {
                type: 'doughnut',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{ data: Object.values(counts) }]
                }
            });
        }
        {
            const counts = countBy(entries, 'category');
            this.addChart('Kategori', {
                type: 'doughnut',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{ data: Object.values(counts)}]
                }
            });
        }

        this.addTable(
            groupBy(entries, 'question', 'category').sort((a, b) => b.count - a.count),
            'Frågor',
            ['Fråga', 'Kategori', 'Antal', 'Andel'],
            (row, sum) => {
                return row
                    ? [row.question, row.category, row.count, percentage(row.count, sum) + '%']
                    : ['', '', sum, '100%'];
                
            });

        const recentComments = entries
              .filter(e => e.comment)
              .sort((a, b) => new Date(b.question_date) - new Date(a.question_date))
              .slice(0, 40);

        if (recentComments.length)
            this.addTable(
                recentComments,
                'Senaste 20 kommentarerna',
                ['Kommentar', 'Fråga', 'Plats', 'Datum/tid'],
                row => {
                    return row
                        ? [row.comment, row.question, row.location, `<span class="date-time">${row.question_date.slice(0, 16).replace('T', ' ')}</span>`]
                        : null;
                });
    }

    async render () {
        this.element = document.createElement('div');

        const categories = await get('categories');
        const categoryOptions = categories
              .map(c => `<option value="${c.id}">${c.name}</option>`)
              .join('');

        let hourOptions = '';
        for (let hour = 6; hour < 24; hour++) {
            hourOptions += `<option>${hour.toString().padStart(2, '0')}</option>`;
        }

        this.element.innerHTML =
            `<form>
                <div class="form-inputs">
                    <div>
                        <label for="user">Användare:</label>
                            <select id="user" name="user">
                            <option></option>
                            ${ config.users.map(x => `<option>${x}</option>`).join() }
                        </select>
                    </div>
                    <div>
                        <label for="type">Typ:</label>
                            <select id="type" name="type">
                            <option></option>
                            ${ config.types.map(x => `<option>${x}</option>`).join() }
                        </select>
                    </div>
                    <div>
                        <label for="location">Plats:</label>
                        <select id="location" name="location">
                            <option></option>
                            ${ config.locations.map(x => `<option>${x}</option>`).join() }
                        </select>
                    </div>
                </div>
                <div class="form-inputs">
                    <div>
                        <label for="categoryId">Kategori:</label>
                        <select id="categoryId" name="categoryId">
                            <option></option>
                            ${categoryOptions}
                        </select>
                    </div>
                    <div>
                        <label for="weekday">Veckodag:</label>
                        <select id="weekday" name="weekday">
                            <option></option>
                            <option value="0">måndag</option>
                            <option value="1">tisdag</option>
                            <option value="2">onsdag</option>
                            <option value="3">torsdag</option>
                            <option value="4">fredag</option>
                            <option value="5">lördag</option>
                            <option value="6">söndag</option>
                        </select>
                    </div>
                    <div>
                        <label for="from_hour">Från timma:</label>
                        <select id="from_hour" name="from_hour">
                            <option></option>
                            ${hourOptions}
                        </select>
                    </div>
                    <div>
                        <label for="to_hour">Till timma:</label>
                        <select id="to_hour" name="to_hour">
                            <option></option>
                            ${hourOptions}
                        </select>
                    </div>
                </div>
                <div class="form-inputs">
                    <div>
                        <label for="from_date">Från datum:</label>
                        <input id="from_date" name="from_date" type="date">
                    </div>
                    <div>
                        <label for="to_date">Till datum:</label>
                        <input id="to_date" name="to_date" type="date">
                    </div>
                    <div>
                        <label for="comment"><input id="comment" name="comment" type="checkbox">Har kommentar</label>
                    </div>
                </div>
            </form>
            <div id="results"></div>`;

        this.results = this.element.querySelector('#results');
        this.form = this.element.querySelector('form');

        this.form.addEventListener('change', () => {
            this.update();
        });

        this.form.elements.user.value = this.root.user;

        const buttons = document.createElement('div');
        buttons.classList.add('form-inputs'); 
        this.form.appendChild(buttons);

        const resetBtn = document.createElement('button'); 
        resetBtn.innerText = 'Nollställ';
        resetBtn.type = 'button';
        resetBtn.addEventListener('click', () => {
            this.form.reset();
            this.form.elements.user.value = this.root.user; // Ev. en dålig idé.
            this.update();
        });
        buttons.appendChild(resetBtn);

        const downloadCSVBtn = document.createElement('button'); 
        downloadCSVBtn.innerText = 'Ladda ner CSV';
        downloadCSVBtn.type = 'button';
        downloadCSVBtn.addEventListener('click', () => {
            const filters = this.getFilters();
            window.location.replace('entries?format=csv' + (filters ? '&' + filters : ''))
        });
        buttons.appendChild(downloadCSVBtn);

        this.update();
        return this.element;
    }
}
