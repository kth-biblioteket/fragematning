
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

const socketPath = '/fragematning/socket.io'; // Specify your desired path
const socketUrl = window.location.origin + socketPath; // Construct the full URL

//const socket = io.connect(socketUrl);

const socket = io.connect(window.location.origin, { path: '/fragematning/socket.io' });

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/todaysactivity';
        this.title = 'Dagens aktivitet';
    }

    addTable () {
        const div = createTable(...arguments);
        div.classList.add('results-table');
        div.classList.add(arguments[4]);
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
                padding: 0
            },
            plugins: {},
            aspectRatio: 1,
            scales: {
                x: {
                  ticks: {
                    font: {
                        size: 10
                    }
                  },
                },
                y: {
                  ticks: {
                    font: {
                        size: 10
                    }
                  },
                },
            }
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
                    backgroundColor: '#6298D2',
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

        //Dagens aktivitet
       
        const currentDate = new Date();
        let startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);
        let endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);
        const filteredData = entries.filter(item => {
            const createdAt = new Date(item.created_at);
            return createdAt >= startDate && createdAt <= endDate;
        });

        
        if (filteredData.length) {
            const counts = countBy(filteredData, 'hour');
            
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

            this.addTable(
                groupBy(filteredData, 'question', 'category').sort((a, b) => b.count - a.count).slice(0, 5),
                'Dagens 5 populäraste frågor',
                ['Fråga', 'Kategori', 'Antal'],
                (row, sum) => {
                    return row
                        ? [row.question, row.category, row.count]
                        : ['', '', sum];
                    
                },
                'results-table-50'
                )
            
            this.addChart('Dagens aktivitet per timme', {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ data: values }]
                },
            });
        }
    }

    async render () {
        this.element = document.createElement('div');

        this.element.innerHTML =
            `<div id="todaysresults"></div>`;

        this.results = this.element.querySelector('#todaysresults');

        this.update();
        socket.on('new-entry', (data) => {
            console.log('new-entry')
            this.update();
        });

        console.log(this.element)
        return this.element;
    }
}
