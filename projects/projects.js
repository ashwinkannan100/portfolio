import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const plot = document.querySelector('#projects-plot');
const legend = document.querySelector('.legend');

let query = '';
let selectedYear = null;

const color = d3.scaleOrdinal(d3.schemeTableau10);
const arc = d3.arc().innerRadius(0).outerRadius(48);
const pie = d3.pie().value(d => d.value).sort(null);

function matchesSearch(project, searchQuery) {
    return Object.values(project).join('\n').toLowerCase().includes(searchQuery.toLowerCase());
}

function getSearchFilteredProjects() {
    return projects.filter(project => matchesSearch(project, query));
}

function getVisibleProjects() {
    return getSearchFilteredProjects().filter(project =>
        selectedYear === null || String(project.year) === String(selectedYear)
    );
}

function renderPieChart(searchFilteredProjects) {
    if (!plot || !legend) return;

    const rolledUp = d3.rollups(
        searchFilteredProjects,
        values => values.length,
        project => project.year
    ).map(([year, count]) => ({ value: count, label: String(year) }))
     .sort((a, b) => d3.ascending(+a.label, +b.label));

    const arcs = pie(rolledUp);
    const paths = plot.querySelectorAll('path');
    paths.forEach(path => path.remove());
    legend.replaceChildren();

    plot.setAttribute('viewBox', '-50 -50 100 100');

    const slices = d3.select(plot)
        .selectAll('path')
        .data(arcs, d => d.data.label)
        .join('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.label))
        .attr('class', d => `slice${selectedYear === d.data.label ? ' selected' : ''}`)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', d => `${d.data.label}: ${d.data.value} projects`)
        .on('click', (event, d) => toggleYear(d.data.label))
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleYear(d.data.label);
            }
        });

    const items = d3.select(legend)
        .selectAll('li')
        .data(rolledUp, d => d.label)
        .join('li')
        .attr('class', d => `legend-item${selectedYear === d.label ? ' selected' : ''}`)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-pressed', d => selectedYear === d.label ? 'true' : 'false')
        .on('click', (event, d) => toggleYear(d.label))
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleYear(d.label);
            }
        });

    items.each(function(d) {
        const item = d3.select(this);
        item.replaceChildren();
        item.append('span')
            .attr('class', 'legend-swatch')
            .style('background-color', color(d.label));
        item.append('span').text(`${d.label} (${d.value})`);
    });
}

function updateView() {
    const searchFiltered = getSearchFilteredProjects();
    const visibleProjects = getVisibleProjects();

    renderPieChart(searchFiltered);
    renderProjects(visibleProjects, projectsContainer, 'h2');

    if (projectsTitle) {
        projectsTitle.textContent = `Projects (${visibleProjects.length})`;
    }
}

function toggleYear(year) {
    selectedYear = selectedYear === String(year) ? null : String(year);
    updateView();
}

searchInput?.addEventListener('input', event => {
    query = event.target.value.trim();
    updateView();
});

updateView();
