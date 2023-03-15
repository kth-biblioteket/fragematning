
import { get, put, del, createTable, logout } from './helpers.js';

// Allt detta är "ad hoc".

export default class {
    constructor (root) {
        this.root = root;
        this.path = '/login';
        this.title = 'Login';
    }

    async update () {
        const scrollY = window.scrollY;
        await this.open();
        window.scrollTo(0, scrollY);
    }

    async render () {
        this.element = document.createElement('div');

        this.element.innerHTML =
            `<div class="login-wrapper">
                <h1>Logga in</h1>
                <form onsubmit="return false;" id="loginform">
                    <label class="form-label">KTH-id</label>
                    <input class="form-control" type="username" id="username" name="username" placeholder="Ange KTH-id" />
                    <label class="form-label">Lösenord</label>
                    <input class="form-control" type="password" id="password" name="password" placeholder="Ange lösenord" />
                    <button id="submit" type="button" class="btn btn-primary" type="submit">Submit</button>
                </form>
                <div id="errormessage">
                </div>
            </div>`;

        this.form = this.element.querySelector('form');
        this.loginbtn = this.element.querySelector('#submit');
        this.form.addEventListener('keydown', function (e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                e.stopImmediatePropagation();
                loginbtn.click();
            }
        });
        
        this.loginbtn.addEventListener('click', () => {
            var username = document.getElementById("username").value;
            var password = document.getElementById("password").value;
            credentials = {
                username,
                password
            }

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    //sessionStorage.setItem("token", JSON.parse(this.responseText).token);
                    location.href = JSON.parse(this.responseText).app_path
                }
                if (this.readyState == 4 && this.status !== 200) {
                    document.getElementById("errormessage").innerHTML = "Wrong credentials!";
                }
            };
            xhttp.open("POST", "/fragematning/api/v1/login");
            xhttp.setRequestHeader("Content-type", "application/json");
            xhttp.send(JSON.stringify(credentials));
        });

        return this.element;
    }
}
