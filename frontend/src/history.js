
import { get, createTable, logout } from './helpers.js';

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/history';
        this.title = 'Historik';
    }

    async render () {
        if (this.root.entries.length) {
            return createTable(
                [...this.root.entries].sort((a, b) => b.created_at.localeCompare(a.created_at)),
                'Frågor',
                ['Tid inskickad', 'Fråga', 'Typ', 'Plats', 'Datum/tid', 'Kommentar', ''],
                (row, sum, tr) => {
                    const undoBtn = document.createElement('button'); 
                    undoBtn.innerHTML = '&#10005;';
                    undoBtn.title = 'Ta bort';
                    undoBtn.type = 'button';
                    undoBtn.addEventListener('click', () => {
                        get('undo/'+row.id).then(() => {
                            this.root.entries.splice(
                                this.root.entries.findIndex(e => e.id === row.id), 1);
                            tr.style.animation = 'fade-out 0.5s';
                        });
                    });

                    return row
                        ? [
                            row.created_at.slice(11, 19),
                            row.description,
                            row.type,
                            row.location,
                            `<span class="date-time">${row.question_date.slice(0, 16).replace('T', ' ')}</span>`,
                            row.comment || '',
                            undoBtn]
                        : null;
                });
        } else {
            const p = document.createElement('p');
            p.innerHTML = 'Historiken är tom (den sparas per session).';
            return p;
        }
    }
}
