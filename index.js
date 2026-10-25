import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projectsContainer = document.querySelector('.projects');
const projects = await fetchJSON('./lib/projects.json');
renderProjects(Array.isArray(projects) ? projects.slice(0, 3) : [], projectsContainer, 'h3');

const statsContainer = document.querySelector('#github-stats');

async function displayGitHubStats() {
    if (!statsContainer) return;

    try {
        const profile = await fetchGitHubData('ashwinkannan100');
        const stats = [
            ['Public repositories', profile.public_repos],
            ['Public gists', profile.public_gists],
            ['Followers', profile.followers],
            ['Following', profile.following],
        ];

        statsContainer.replaceChildren();
        const list = document.createElement('ul');
        for (const [label, value] of stats) {
            const item = document.createElement('li');
            item.textContent = `${label}: ${value}`;
            list.append(item);
        }
        statsContainer.append(list);

        const profileLink = document.createElement('a');
        profileLink.href = profile.html_url;
        profileLink.textContent = 'View my GitHub profile';
        profileLink.target = '_blank';
        profileLink.rel = 'noopener noreferrer';
        statsContainer.append(profileLink);
    } catch (error) {
        console.error('Unable to load GitHub statistics:', error);
        statsContainer.textContent = 'GitHub statistics are temporarily unavailable.';
    }
}

displayGitHubStats();
