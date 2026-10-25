console.log('IT’S ALIVE!');

function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

// Work out the site's base path so links work on a local server and GitHub Pages.
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
let BASE_PATH = '/';

if (!isLocal && location.hostname.endsWith('github.io')) {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const knownSections = ['projects', 'resume', 'contact'];
    const sectionIndex = pathParts.findIndex((part) => knownSections.includes(part));

    if (sectionIndex > 0) {
        BASE_PATH = '/' + pathParts.slice(0, sectionIndex).join('/') + '/';
    } else if (pathParts.length > 0 && !knownSections.includes(pathParts[0]) && pathParts[0] !== 'index.html') {
        BASE_PATH = '/' + pathParts[0] + '/';
    }
}

// Create the navigation menu once, so every page uses the same links.
const pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'resume/', title: 'Resume' },
    { url: 'contact/', title: 'Contact' },
    { url: 'https://github.com/ashwinkannan100', title: 'GitHub' },
];

const nav = document.createElement('nav');
nav.setAttribute('aria-label', 'Main navigation');

function normalizedPath(path) {
    return path.replace(/index\.html$/, '').replace(/\/+$/, '/') || '/';
}

for (const page of pages) {
    const url = page.url.startsWith('http') ? page.url : BASE_PATH + page.url;
    const link = document.createElement('a');
    link.href = url;
    link.textContent = page.title;

    if (link.host === location.host && normalizedPath(link.pathname) === normalizedPath(location.pathname)) {
        link.classList.add('current');
        link.setAttribute('aria-current', 'page');
    }

    if (link.host !== location.host) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    }

    nav.append(link);
}

document.body.prepend(nav);

// Add a theme selector. CSS handles the automatic operating-system theme.
document.body.insertAdjacentHTML(
    'afterbegin',
    `<label class="color-scheme">Theme:
        <select aria-label="Color theme">
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`
);

const themeSelect = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
    document.documentElement.style.setProperty('color-scheme', colorScheme);
    themeSelect.value = colorScheme;
}

if ('colorScheme' in localStorage) {
    setColorScheme(localStorage.colorScheme);
}

themeSelect.addEventListener('input', (event) => {
    const colorScheme = event.target.value;
    setColorScheme(colorScheme);
    localStorage.colorScheme = colorScheme;
});

// Improve the mailto contact form by encoding spaces and special characters correctly.
const form = document.querySelector('form');
form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const parameters = [];

    for (const [name, value] of data) {
        parameters.push(`${name}=${encodeURIComponent(value)}`);
    }

    const url = `${form.action}?${parameters.join('&')}`;
    location.href = url;
});


// Lab 4: Fetch JSON data and return the parsed result.
export async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed (${response.status} ${response.statusText})`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching or parsing JSON data:', error);
        return [];
    }
}

// Lab 4: Render project data into a container. Accepts an array of projects.
export function renderProjects(projects, containerElement, headingLevel = 'h2') {
    if (!containerElement) {
        console.error('renderProjects: projects container was not found.');
        return;
    }

    containerElement.replaceChildren();

    if (!Array.isArray(projects) || projects.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No projects to display yet.';
        containerElement.append(message);
        return;
    }

    const validHeading = /^h[1-6]$/.test(headingLevel) ? headingLevel : 'h2';

    for (const project of projects) {
        const article = document.createElement('article');
        const heading = document.createElement(validHeading);
        heading.textContent = project.title || 'Untitled project';
        article.append(heading);

        if (project.year) {
            const year = document.createElement('p');
            year.className = 'project-tag';
            year.textContent = String(project.year);
            article.append(year);
        }

        if (project.image) {
            const image = document.createElement('img');
            image.src = project.image;
            image.alt = project.title ? `${project.title} project image` : 'Project image';
            image.loading = 'lazy';
            image.addEventListener('error', () => image.remove(), { once: true });
            article.append(image);
        }

        const description = document.createElement('p');
        description.textContent = project.description || 'Description coming soon.';
        article.append(description);
        containerElement.append(article);
    }
}

// Lab 4: Retrieve public profile information from the GitHub API.
export async function fetchGitHubData(username) {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
    if (!response.ok) {
        throw new Error(`GitHub API request failed (${response.status})`);
    }
    return response.json();
}
