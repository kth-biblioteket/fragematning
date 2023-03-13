
import { get, put, del, createTable, logout } from './helpers.js';

// Allt detta är "ad hoc".

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/admin';
        this.title = 'Administration';
        this.restricted = true;
    }

    createDelBtn (func) {
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '&#10005;';
        delBtn.title = 'Ta bort';
        delBtn.type = 'button';
        delBtn.addEventListener('click', func);
        return delBtn;
    }

    addCategory (row = {}, tr) {
        const fields = [];

        fields[0] = document.createElement('input');
        fields[0].type = 'text';
        fields[0].value = row.name || '';
        fields[0].required = 'required';

        fields[1] = document.createElement('input');
        fields[1].type = 'text';
        fields[1].value = row.sort_order || '';

        const category = {
            id: row.id,
            get name() { return fields[0].value },
            get sort_order() { return fields[1].value }
        };
        this.categories.push(category);

        if (!row.entry_count) {
            const delBtn = this.createDelBtn(() => {
                if (row.id) {
                    del('categories/' + row.id).then(() => this.update());
                } else {
                    this.categories.splice(
                        this.categories.findIndex(c => c === category), 1);
                    tr.style.animation = 'fade-out 0.5s';
                }
            });
            return fields.concat([delBtn]);
        }

        return fields;
    }

    addQuestion (row = {}, tr) {
        const fields = [];

        fields[0] = document.createElement('input');
        fields[0].type = 'text';
        fields[0].value = row.description || '';
        fields[0].required = 'required';

        fields[1] = document.createElement('select');
        fields[1].innerHTML = this.categories.map(c => `<option value="${c.id}">${c.name}</option>`);
        if (row.categoryId) fields[1].value = row.categoryId;

        fields[2] = document.createElement('input');
        fields[2].type = 'text';
        fields[2].value = row.info || '';

        fields[3] = document.createElement('input');
        fields[3].type = 'text';
        fields[3].value = row.user || '';
        fields[3].style.width = '100px';

        fields[4] = document.createElement('select');
        fields[4].innerHTML = '<option>Ja</option><option>Nej</option>';
        fields[4].value = row.requires?.split(',')?.includes('comment') ? 'Ja' : 'Nej';

        const question = {
            id: row.id,
            get description() { return fields[0].value },
            get category() { return fields[1].value },
            get info() { return fields[2].value },
            get user() { return fields[3].value.replace(/\s+/g, '') || null},
            get requires() {
                const requires = new Set(row.requires?.split(','));
                if (fields[4].value === 'Ja')
                    requires.add('comment');
                else
                    requires.delete('comment');
                return Array.from(requires).join(',') || null;
            }
        };
        this.questions.push(question);

        if (!row.entry_count) {
            const delBtn = this.createDelBtn(() => {
                if (row.id) {
                    del('questions/' + row.id).then(() => this.update());
                } else {
                    this.questions.splice(
                        this.questions.findIndex(q => q === question), 1);
                    tr.style.animation = 'fade-out 0.5s';
                }
            });
            return fields.concat([delBtn]);
        }

        return fields.concat(['']);
    }

    addAdminFunctions (table, saveFunc, addRowFunc) {
        const div = document.createElement('div');

        const addBtn = document.createElement('button');
        addBtn.innerText = 'Lägg till';
        addBtn.type = 'button';
        addBtn.addEventListener('click', () => {
            const tr = table.tBodies[0].insertRow(-1);
            addRowFunc({}, tr).forEach(field => {
                const td = tr.insertCell(-1);
                td.appendChild(field);
            })
            tr.querySelector('input').focus();
        });
        div.appendChild(addBtn);

        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Spara ändringar';
        saveBtn.type = 'button';
        saveBtn.addEventListener('click', () => {
            if (Array.from(table.querySelectorAll('input')).every(q => q.checkValidity())) {
                saveFunc().then(() => this.update());
            } else {
                alert('Fyll i alla obligatoriska fält.');
            }
        });
        div.appendChild(saveBtn);

        div.classList.add('admin-functions');
        table.parentNode.appendChild(div);
    }

    async update () {
        const scrollY = window.scrollY;
        await this.open();
        window.scrollTo(0, scrollY);
    }

    async render () {
        const div = document.createElement('div');
        div.innerHTML = '<p>Varning: Ändringar påverkar befintligt resultat. Undvik därför att ändra kategorier/frågor som använts (en längre tid).</p>';

        this.categories = [];
        this.questions = [];

        const categoriesTable = createTable(
            await get('categories?count_entries=1'),
            'Kategorier',
            ['*Kategori', 'Sortering', ''],
            (row, sum, tr) => row ? this.addCategory(row, tr) : null);

        this.addAdminFunctions(
            categoriesTable.querySelector('table'),
            () => put('categories', this.categories),
            this.addCategory.bind(this)
        );

        const questionsTable = createTable(
            await get('questions?count_entries=1'),
            'Frågor',
            ['*Fråga', '*Kategori', 'Hjälptext', 'Användare', 'Kommentar', ''],
            (row, sum, tr) => row ? this.addQuestion(row, tr) : null);

        this.addAdminFunctions(
            questionsTable.querySelector('table'),
            () => put('questions', this.questions),
            this.addQuestion.bind(this)
        );

        categoriesTable.classList.add('admin-table');
        questionsTable.classList.add('admin-table');
        div.appendChild(categoriesTable);
        div.appendChild(questionsTable);

        return div;
    }
}
