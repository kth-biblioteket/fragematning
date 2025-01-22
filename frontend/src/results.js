
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
const colorSortOrder=config.colorSortOrder;

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/results';
        this.title = 'Resultat';
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

        const sliderContainer = document.createElement('div');
        const sliderLabel = document.createElement('label');
        const slider = document.createElement('input');
        const sliderValueDisplay = document.createElement('span');

        const step = 100;

        const allDataValues = chart.data.datasets.flatMap(dataset => dataset.data || []);
        const rawMax = Math.max(...allDataValues, 100); // Hämta maxvärdet från alla datasets, med en fallback på 100
        const currentMax = Math.ceil(rawMax / step) * step; // Anpassa till närmaste steg
        const sliderMax = Math.ceil((currentMax * 2) / step) * step; // Dubbla för eventuell marginal

        slider.type = 'range';
        slider.min = '0'; 
        slider.max = sliderMax.toString();;
        slider.step = step.toString(); 
        slider.value = currentMax.toString(); 
        slider.id = `slider-${title.replace(/\s+/g, '-')}`;
        sliderLabel.innerHTML = `Maxvärde Y: `;
        sliderValueDisplay.textContent = slider.value;

        sliderContainer.classList.add('slider-container');
        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(sliderValueDisplay);

        div.innerHTML = `<h2>${title}</h2>`;
        div.classList.add('chart');
        div.classList.add('chart-' + chart.type);
        div.appendChild(canvas)
        if (chart.type === 'bar') {
            div.appendChild(sliderContainer);
        }
        this.results.appendChild(div);

        const setCategoryColors = (labels) => {
            return labels.map(label => config.chartcolors[label] || "#000000");
        };

        chart.options = Object.assign({
            layout: {
                padding: 20
            },
            plugins: {},
            aspectRatio: 1
        }, chart.options);

        if (chart.type === 'bar') {
            chart.options.scales = {
                y: {
                    max: currentMax
                }
            };
        }

        chart.options.plugins.tooltip = {
            callbacks: {
                label: tooltipItem => {
                    const datasetIndex = tooltipItem.datasetIndex; // Index för aktuellt dataset (år)
                    const value = chart.data.datasets[datasetIndex].data[tooltipItem.dataIndex]; // Värde för det aktuella året
                    const sum = chart.data.datasets
                        .map(ds => ds.data[tooltipItem.dataIndex]) // Hämta värden från alla datasets för den aktuella datapunkten
                        .reduce((acc, cur) => acc += cur, 0); // Beräkna totalen
                    const percentageValue = ((value / sum) * 100).toFixed(2); // Beräkna procentandel
                    if (chart.type === 'bar') {
                        return `${chart.data.datasets[datasetIndex].label || ''}: ${value} st`; // Endast antal
                    } else {
                        const sum = chart.data.datasets[0].data.reduce((acc, cur) => acc += cur, 0);
                        return `${chart.data.datasets[datasetIndex].label || ''}: ${percentage(value, sum)}% (${value} st)`; // Procent och antal
                    }
                },
                title: tooltipItems => {
                    return tooltipItems[0].label; // Behåll titeln som den är
                }
            }
        };

        if (chart.type === 'bar') {
            if (chart.options && chart.options.plugins && chart.options.plugins.legend) {
                //do nothing
            } else {
                chart.options.plugins.legend = { display: false };
            }

            chart.data.datasets = chart.data.datasets.map(ds =>
                Object.assign({
                    backgroundColor: '#666',
                }, ds)
            );
        } else if (chart.type === 'doughnut') {
            chart.options.layout.padding = 5;

            const labels = chart.data.labels || [];
            const backgroundColors = setCategoryColors(labels);

            chart.data.datasets = chart.data.datasets.map(ds =>
                Object.assign({
                    backgroundColor: backgroundColors,
                }, ds)
            );
        }
        
        const chartInstance = new Chart(canvas, chart);

        if (chart.type === 'bar') {
            slider.addEventListener('input', function () {
                const newMax = Number(slider.value);
                console.log('New max value:', newMax);
                sliderValueDisplay.textContent = newMax;

                if (chartInstance.options.scales && chartInstance.options.scales.y) {
                    chartInstance.options.scales.y.max = newMax;
                    chartInstance.update();
                }
            });
        }

        return chartInstance;
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

        let datasets = [];

        const entries = await get('entries' + (queryString ? '?' + queryString : ''));

        if (!entries.length) {
            this.results.innerHTML = '<p>Inga data för urvalet.</p>';
            return false;
        }

        // Kontrollera om gruppering per år är aktiverad
        const groupByYearBoolean = document.getElementById('groupByYearSwitch').checked;


        const groupByYear = (entries, key) => {
            const grouped = {};
            entries.forEach(entry => {
                const year = entry.year;
                const value = entry[key];
                if (!grouped[year]) {
                    grouped[year] = {};
                }
                if (!grouped[year][value]) {
                    grouped[year][value] = 0;
                }
                grouped[year][value]++;
            });
            return grouped;
        };

        const setCategoryColors = (labels) => {
            return labels.map(label => config.chartcolors[label] || "#000000");
        };
        const createDatasets = (groupedData, labelPrefix) => {
            const labels = Object.keys(groupedData); // Åren eller andra nycklar
            const colors = setCategoryColors(labels); // Färger baserade på labels

            return Object.entries(groupedData).map(([year, counts], index) => {
                const data = new Array(Math.max(...Object.keys(counts).map(Number)) + 1).fill(0);
                Object.entries(counts).forEach(([key, count]) => {
                    data[key] = count;
                });
                return {
                    label: `${labelPrefix} ${year}`,
                    data: data,
                    backgroundColor: colors[index],
                };
            });
        };

        {
            if (groupByYearBoolean) {
                const groupedByYear = groupByYear(entries, 'hour');
                datasets = createDatasets(groupedByYear, '');
            } else {
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
                datasets = [{ data: values }]
            }
            this.addChart('Timma', {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => i),
                    datasets: datasets,
                },
                options: {
                    plugins: {
                        legend: {
                            display:  groupByYearBoolean,
                            position: 'top', // Placera över diagrammet
                        },
                    },
                },
            });
        }
    
        {
            datasets = [];
            if (groupByYearBoolean) {
                const groupedByYear = groupByYear(entries, 'weekday');
                datasets = createDatasets(groupedByYear, '');
            } else {
                const counts = countBy(entries, 'weekday');
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
                datasets = [{ data: values }]
            }
            this.addChart('Veckodag', {
                type: 'bar',
                data: {
                    labels: ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'],
                    datasets: datasets,
                },
                options: {
                    plugins: {
                        legend: {
                            display: groupByYearBoolean, // Aktivera legend
                            position: 'top', // Placera över diagrammet
                        },
                    },
                },
            });
        }
    
        {
            datasets = [];
            if (groupByYearBoolean) {
                const groupedByYear = groupByYear(entries, 'week');
                datasets = createDatasets(groupedByYear, '');
            } else {
                const counts = countBy(entries, 'week');
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
                datasets = [{ data: values }]
            }
            this.addChart('Vecka', {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 53 }, (_, i) => i + 1),
                    datasets: datasets,
                },
                options: {
                    plugins: {
                        legend: {
                            display: groupByYearBoolean, // Aktivera legend
                            position: 'top', // Placera över diagrammet
                        },
                    },
                },
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
            const sortedEntries = Object.entries(counts);

            const sortedEntriesByColor = sortedEntries.sort((a, b) => {
                const colorA = config.chartcolors[a[0]] || "#000000";
                const colorB = config.chartcolors[b[0]] || "#000000";
                const indexA = colorSortOrder.indexOf(colorA);
                const indexB = colorSortOrder.indexOf(colorB);

                return indexA - indexB;
            });

            const sortedLabels = sortedEntriesByColor.map(entry => entry[0]);
            const sortedData = sortedEntriesByColor.map(entry => entry[1]);

            this.addChart('Typ', {
                type: 'doughnut',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedData
                    }]
                }
            });
        }
        {
            const counts = countBy(entries, 'location');
            const sortedEntries = Object.entries(counts);

            const sortedEntriesByColor = sortedEntries.sort((a, b) => {
                const colorA = config.chartcolors[a[0]] || "#000000";
                const colorB = config.chartcolors[b[0]] || "#000000";
                const indexA = colorSortOrder.indexOf(colorA);
                const indexB = colorSortOrder.indexOf(colorB);

                return indexA - indexB;
            });

            const sortedLabels = sortedEntriesByColor.map(entry => entry[0]);
            const sortedData = sortedEntriesByColor.map(entry => entry[1]);

            this.addChart('Plats', {
                type: 'doughnut',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedData
                    }]
                }
            });
        }
        {
            const counts = countBy(entries, 'category');
            
            const sortedEntries = Object.entries(counts);

            const sortedEntriesByColor = sortedEntries.sort((a, b) => {
                const colorA = config.chartcolors[a[0]] || "#000000";
                const colorB = config.chartcolors[b[0]] || "#000000";
                const indexA = colorSortOrder.indexOf(colorA);
                const indexB = colorSortOrder.indexOf(colorB);

                return indexA - indexB;
            });

            const sortedLabels = sortedEntriesByColor.map(entry => entry[0]);
            const sortedData = sortedEntriesByColor.map(entry => entry[1]);

            this.addChart('Kategori', {
                type: 'doughnut',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedData
                    }]
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
                            ${ config.results.types.map(x => `<option>${x}</option>`).join() }
                        </select>
                    </div>
                    <div>
                        <label for="location">Plats:</label>
                        <select id="location" name="location">
                            <option></option>
                            ${ config.results.locations.map(x => `<option>${x}</option>`).join() }
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
                    <label>
                        <input type="checkbox" id="groupByYearSwitch">
                        Gruppera per år
                    </label>
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
