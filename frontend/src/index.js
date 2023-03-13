
import './style.css';
require.context('./', false, /custom\.css$/);

import { get } from './helpers.js';
import Input from './input.js';
import History from './history.js';
import Results from './results.js';
import Admin from './admin.js';

const config = require('./config.json');

// TODO: Bryt ut generell funktionalitet till en klass.

const root = {
    title: config.title || 'Frågemätning',
    header: document.querySelector('header'),
    kth_view: document.getElementById('kth-view'),
    main: document.querySelector('main'),
    nav: document.querySelector('nav'),
    menu: document.createElement('ol'),
    instructions: document.getElementById('instructions'),
    type: null,
    location: null,
    entries: [],
    // TODO: Dubbelkolla att detta fungerar med IE.
    URLParams: new URLSearchParams(window.location.search.substr(1)),
    session: {
        // Sidan laddas om automatiskt efter en viss tid.
        TTL: (1000 * 60) * config.session_ttl_minutes,
        reset: function () {
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = setTimeout(function () {
                alert('Sessionen har löpt ut. Sidan kommer att laddas om.');

                // Omladdning av sidan förebygger problem som uppstår
                // då ev. EZproxy-session löpt ut (förutsatt att
                // MaxLifetime i EZproxy-konfigurationen ungefär
                // motsvarar session.TTL).
                location.reload();
            }, this.TTL)
        }
    }
};

root.user = root.URLParams.get('user') || config.users[0];
root.session.reset();
root.nav.appendChild(root.menu);
root.views = {};
root.activeMenuItem = null;

document.querySelector('title').innerText = root.title;

if (config.instructions)
    root.instructions.innerHTML = config.instructions;

const availableViews = config.read_only_interface
      ? [Results, Admin]
      : [Input, History, Results, Admin];

availableViews.forEach((View) => {
    const view = new View(root);
    root.views[view.path] = view;
    view.menuItem = document.createElement('li');

    view.menuItem.innerHTML = view.menuItemText || view.title;
    root.menu.appendChild(view.menuItem);

    view.open = async () => {
        let authorized = true
        await get('authorize', null, false)
            .catch(xhr => {
                if (xhr.status === 401){
                    alert('Not authorized');
                    return location.href = 'fragematning'
                }
            })
            .then(response => {
                //Restricted = true => vyn ska visas endast för admin
                if (view.restricted) {
                    if (response.role !== 'admin') {
                        authorized = false;
                        alert('Not authorized');
                        return location.href = 'fragematning'
                    }
                } 
            })

        if (authorized) {
            root.activeMenuItem?.classList.remove('active-menu-item');
            view.menuItem.classList.add('active-menu-item');
            root.activeMenuItem = view.menuItem;
            //root.header.innerHTML = `<h2>${view.title}</h2>`;
            root.kth_view.innerHTML = `${view.title}`
            root.main.innerHTML = '';
            return view.render().then(element => root.main.appendChild(element));
        }
    }

    view.menuItem.addEventListener('click', () => {
        view.open().then(() => {
            history.pushState({ view: view.path }, document.title, root.mountPoint + view.path + location.search);
        });
    });
});

const path = location.pathname.match(/(.*)(\/.*)/);
root.mountPoint = path[1];
(root.views[path[2]] || root.views['/'] || Object.values(root.views)[0]).menuItem.click();

window.addEventListener('popstate', (event) => {
    if (event.state)
        root.views[event.state.view].open();
});

document.addEventListener('animationend', (e) => {
    if (e.animationName === 'button-animation') {
        e.target.classList.remove('button-animation');
    }
    if (/-out$/.test(e.animationName)) {
        e.target.remove();
    }
});
