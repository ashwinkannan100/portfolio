import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Change this to the URL of the GitHub repository containing this portfolio.
const REPOSITORY_URL = 'https://github.com/ashwinkannan100/portfolio';

const summary = document.querySelector('#commit-info');
const plot = d3.select('#commits-plot');
const tooltip = d3.select('#commit-tooltip');
const selectionCount = document.querySelector('#selection-count');
const languageBreakdown = document.querySelector('#language-breakdown');

const margin = { top: 25, right: 25, bottom: 45, left: 65 };
const width = 900;
const height = 500;
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

plot.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

function parseRows(rows) {
  return rows.map(row => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime)
  }));
}

function makeCommits(data) {
  const grouped = d3.groups(data, d => d.commit);
  return grouped.map(([id, lines]) => {
    const first = lines[0];
    const commit = {
      id,
      url: `${REPOSITORY_URL}/commit/${id}`,
      author: first.author,
      date: first.date,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      hourFrac: first.datetime.getHours() + first.datetime.getMinutes() / 60,
      totalLines: d3.sum(lines, d => d.length)
    };
    Object.defineProperty(commit, 'lines', { value: lines });
    return commit;
  });
}

function renderCommitInfo(data, commits) {
  const files = new Set(data.map(d => d.file));
  const longestFile = d3.greatest(
    d3.rollups(data, rows => d3.sum(rows, d => d.length), d => d.file),
    d => d[1]
  );
  const stats = [
    ['Lines of code', d3.sum(data, d => d.length).toLocaleString()],
    ['Commits', commits.length.toLocaleString()],
    ['Files touched', files.size.toLocaleString()],
    ['Average lines per commit', d3.mean(commits, d => d.totalLines)?.toFixed(1) ?? '0'],
    ['Longest file by changed lines', longestFile ? `${longestFile[0]} (${longestFile[1].toLocaleString()} lines)` : 'N/A']
  ];

  summary.replaceChildren();
  const list = document.createElement('dl');
  list.className = 'meta-stats';
  for (const [label, value] of stats) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    list.append(wrapper);
  }
  summary.append(list);
}

function renderTooltip(event, commit) {
  tooltip.select('.commit-id').text(commit.id.slice(0, 8));
  tooltip.select('.commit-date').text(d3.timeFormat('%B %-d, %Y')(commit.date));
  tooltip.select('.commit-time').text(commit.time);
  tooltip.select('.commit-lines').text(commit.totalLines.toLocaleString());
  tooltip.select('.commit-author').text(commit.author);
  tooltip.select('.commit-message').text(commit.lines[0].message || 'No message available');
  tooltip.select('.commit-link').attr('href', commit.url);
  tooltip.attr('hidden', null)
    .style('left', `${event.clientX + 12}px`)
    .style('top', `${event.clientY + 12}px`);
}

function renderLanguageBreakdown(selected) {
  languageBreakdown.replaceChildren();
  if (!selected.length) {
    languageBreakdown.textContent = 'Brush the chart to see the languages in the selected commits.';
    return;
  }

  const counts = d3.rollups(
  selected.flatMap(commit => commit.lines),
  rows => d3.sum(rows, d => d.length),
  d => d.type || 'Unknown'
).sort((a, b) => d3.descending(a[1], b[1]));

  const heading = document.createElement('h3');
  heading.textContent = 'Languages in selected commits';
  const list = document.createElement('ul');
  for (const [language, count] of counts) {
    const item = document.createElement('li');
    item.textContent = `${language}: ${count} changed lines`;
    list.append(item);
  }
  languageBreakdown.append(heading, list);
}

function renderChart(commits) {
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.date))
    .range([0, innerWidth]);

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([innerHeight, 0]);

  const sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(commits, d => d.totalLines) || 1])
    .range([3, 18]);

  const chart = plot.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  chart.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(''));

  chart.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale));

  chart.append('g').call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d}:00`));

  chart.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 40)
    .attr('text-anchor', 'middle')
    .text('Commit date');

  chart.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -48)
    .attr('text-anchor', 'middle')
    .text('Time of day');

  // Larger commits are drawn first so small commits remain visible.
  const sortedCommits = [...commits].sort((a, b) => d3.descending(a.totalLines, b.totalLines));

  const dots = chart.append('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(sortedCommits, d => d.id)
    .join('circle')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => sizeScale(d.totalLines))
    .attr('fill', 'var(--color-accent)')
    .attr('fill-opacity', 0.65)
    .attr('stroke', 'Canvas')
    .attr('stroke-width', 0.7)
    .on('pointerenter', (event, d) => renderTooltip(event, d))
    .on('pointermove', (event) => {
      tooltip.style('left', `${event.clientX + 12}px`).style('top', `${event.clientY + 12}px`);
    })
    .on('pointerleave', () => tooltip.attr('hidden', true));

  // Keep the brush above the dots so it can receive pointer input.
  const brush = d3.brush()
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on('start brush end', ({ selection }) => {
      const selected = selection
        ? commits.filter(d => {
            const x = xScale(d.date);
            const y = yScale(d.hourFrac);
            return selection[0][0] <= x && x <= selection[1][0]
              && selection[0][1] <= y && y <= selection[1][1];
          })
        : [];

      dots.classed('selected', d => selected.includes(d))
        .attr('fill-opacity', d => !selection || selected.includes(d) ? 0.85 : 0.12);

      selectionCount.textContent = selection
        ? `${selected.length} commit${selected.length === 1 ? '' : 's'} selected.`
        : 'No commits selected.';
      renderLanguageBreakdown(selected);
    });

  chart.append('g').attr('class', 'brush').call(brush);
  chart.select('.dots').raise();
  renderLanguageBreakdown([]);
}

async function main() {
  try {
    const data = parseRows(await d3.csv('./loc.csv'));
    if (!data.length) throw new Error('loc.csv is empty. Generate it using the command in README-LAB6.md.');
    const commits = makeCommits(data);
    renderCommitInfo(data, commits);
    renderChart(commits);
  } catch (error) {
    console.error(error);
    summary.textContent = `Could not load repository data: ${error.message}`;
  }
}

main();
