
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const REPOSITORY_URL = 'https://github.com/ashwinkannan100/portfolio';
const summary = document.querySelector('#commit-info');
const plot = d3.select('#commits-plot');
const tooltip = d3.select('#commit-tooltip');
const selectionCount = document.querySelector('#selection-count');
const languageBreakdown = document.querySelector('#language-breakdown');
const progressSlider = document.querySelector('#commit-progress');
const progressTime = document.querySelector('#commit-time');
const margin = { top: 25, right: 25, bottom: 45, left: 65 };
const width = 900, height = 500;
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;
const technologyColors = d3.scaleOrdinal(d3.schemeTableau10);

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
  return d3.groups(data, d => d.commit).map(([id, lines]) => {
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
      totalLines: lines.length
    };
    Object.defineProperty(commit, 'lines', { value: lines });
    return commit;
  }).sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function renderCommitInfo(data, commits) {
  const files = new Set(data.map(d => d.file));
  const longestFile = d3.greatest(
    d3.rollups(data, rows => rows.length, d => d.file),
    d => d[1]
  );
  const stats = [
    ['Recorded lines', data.length.toLocaleString()],
    ['Commits', commits.length.toLocaleString()],
    ['Files touched', files.size.toLocaleString()],
    ['Average lines per commit', d3.mean(commits, d => d.totalLines)?.toFixed(1) ?? '0'],
    ['File with most recorded lines', longestFile ? `${longestFile[0]} (${longestFile[1].toLocaleString()} lines)` : 'N/A']
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
    rows => rows.length,
    d => d.type || 'Unknown'
  ).sort((a, b) => d3.descending(a[1], b[1]));
  const heading = document.createElement('h3');
  heading.textContent = 'Languages in selected commits';
  const list = document.createElement('ul');
  for (const [language, count] of counts) {
    const item = document.createElement('li');
    item.textContent = `${language}: ${count} recorded lines`;
    list.append(item);
  }
  languageBreakdown.append(heading, list);
}

function createChart(commits) {
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.date))
    .range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain([0, 24]).range([innerHeight, 0]);
  const sizeScale = d3.scaleSqrt()
    .domain([0, d3.max(commits, d => d.totalLines) || 1])
    .range([3, 18]);
  const chart = plot.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  chart.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickFormat(''));
  const xAxis = chart.append('g').attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`);
  chart.append('g').attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d}:00`));
  chart.append('text').attr('class', 'axis-label')
    .attr('x', innerWidth / 2).attr('y', innerHeight + 40)
    .attr('text-anchor', 'middle').text('Commit date');
  chart.append('text').attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)').attr('x', -innerHeight / 2)
    .attr('y', -48).attr('text-anchor', 'middle').text('Time of day');
  const dotsLayer = chart.append('g').attr('class', 'dots');
  let displayedCommits = commits;
  let dots;

  const brush = d3.brush()
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on('start brush end', ({ selection }) => {
      const selected = selection ? displayedCommits.filter(d => {
        const x = xScale(d.date), y = yScale(d.hourFrac);
        return selection[0][0] <= x && x <= selection[1][0]
          && selection[0][1] <= y && y <= selection[1][1];
      }) : [];
      if (dots) dots.classed('selected', d => selected.includes(d))
        .attr('fill-opacity', d => !selection || selected.includes(d) ? 0.85 : 0.12);
      selectionCount.textContent = selection
        ? `${selected.length} commit${selected.length === 1 ? '' : 's'} selected.`
        : 'No commits selected.';
      renderLanguageBreakdown(selected);
    });
  const brushLayer = chart.append('g').attr('class', 'brush').call(brush);

  function update(filtered) {
    displayedCommits = filtered;
    xAxis.call(d3.axisBottom(xScale));
    const sorted = [...filtered].sort((a, b) => d3.descending(a.totalLines, b.totalLines));
    dots = dotsLayer.selectAll('circle')
      .data(sorted, d => d.id)
      .join(
        enter => enter.append('circle').attr('r', 0).attr('fill-opacity', 0)
          .call(enter => enter.transition().duration(250)
            .attr('r', d => sizeScale(d.totalLines)).attr('fill-opacity', 0.85)),
        update => update,
        exit => exit.transition().duration(180).attr('r', 0).attr('fill-opacity', 0).remove()
      )
      .attr('cx', d => xScale(d.date))
      .attr('cy', d => yScale(d.hourFrac))
      .attr('fill', 'var(--color-accent)')
      .attr('stroke', 'Canvas')
      .attr('stroke-width', 0.7)
      .on('pointerenter', (event, d) => renderTooltip(event, d))
      .on('pointermove', event => {
        tooltip.style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY + 12}px`);
      })
      .on('pointerleave', () => tooltip.attr('hidden', true));
    brushLayer.call(brush.move, null);
    dotsLayer.raise();
  }
  renderLanguageBreakdown([]);
  return update;
}

function updateFileDisplay(commits) {
  const lines = commits.flatMap(commit => commit.lines);
  const files = d3.groups(lines, d => d.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => b.lines.length - a.lines.length);
  const fileRows = d3.select('#files').selectAll('.file-row')
    .data(files, d => d.name)
    .join(enter => {
      const row = enter.append('div').attr('class', 'file-row');
      const term = row.append('dt');
      term.append('code');
      term.append('small');
      row.append('dd');
      return row;
    });
  fileRows.order();
  fileRows.select('dt code').text(d => d.name);
  fileRows.select('dt small').text(d => `${d.lines.length.toLocaleString()} lines`);
  fileRows.select('dd').selectAll('.loc')
    .data(d => d.lines, (d, i) => `${d.commit}:${d.file}:${d.line}:${i}`)
    .join('div')
    .attr('class', 'loc')
    .style('--dot-color', d => technologyColors(d.type || 'Unknown'))
    .attr('title', d => `${d.type || 'Unknown'} · ${d.file}`);
  const technologies = [...new Set(lines.map(d => d.type || 'Unknown'))].sort();
  d3.select('#file-legend').selectAll('.file-legend-item')
    .data(technologies, d => d)
    .join('span')
    .attr('class', 'file-legend-item')
    .html('')
    .each(function(type) {
      const item = d3.select(this);
      item.append('i').style('background', technologyColors(type));
      item.append('span').text(type);
    });
}

function renderStory(commits, setProgress) {
  const story = d3.select('#scatter-story');
  story.selectAll('.step')
    .data(commits, d => d.id)
    .join('div')
    .attr('class', 'step')
    .each(function(commit, i) {
      const node = d3.select(this);
      node.selectAll('*').remove();
      node.append('p').text(`Commit ${i + 1} of ${commits.length}`);
      node.append('h3').text(commit.datetime.toLocaleString('en-US', {
        dateStyle: 'medium', timeStyle: 'short'
      }));
      const paragraph = node.append('p');
      paragraph.append('span').text(`This commit has ${commit.totalLines.toLocaleString()} recorded lines across ${new Set(commit.lines.map(d => d.file)).size} files. `);
      paragraph.append('a').attr('href', commit.url)
        .attr('target', '_blank').attr('rel', 'noopener noreferrer')
        .text('View this commit');
    });
  const scroller = scrollama();
  scroller.setup({ container: '#scrolly-1', step: '#scrolly-1 .step', offset: 0.5 })
    .onStepEnter(({ element }) => {
      story.selectAll('.step').classed('active', function() { return this === element; });
      setProgress(element.__data__.datetime);
    });
  window.addEventListener('resize', () => scroller.resize());
}

async function main() {
  try {
    const data = parseRows(await d3.csv('./loc.csv'));
    if (!data.length) throw new Error('loc.csv is empty. Generate it using the command in README-LAB6.md.');
    const commits = makeCommits(data);
    const updateChart = createChart(commits);
    const timeline = d3.scaleTime()
      .domain(d3.extent(commits, d => d.datetime))
      .range([0, 100]);

    function updateToDate(date) {
      const filtered = commits.filter(d => d.datetime <= date);
      progressSlider.value = String(Math.max(0, Math.min(100, timeline(date))));
      progressTime.textContent = date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      progressTime.dateTime = date.toISOString();
      updateChart(filtered);
      renderCommitInfo(filtered.flatMap(d => d.lines), filtered);
      updateFileDisplay(filtered);
    }
    progressSlider.addEventListener('input', () => updateToDate(timeline.invert(+progressSlider.value)));
    updateToDate(timeline.invert(100));
    renderStory(commits, updateToDate);
  } catch (error) {
    console.error(error);
    summary.textContent = `Could not load repository data: ${error.message}`;
  }
}

main();
