import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// KaTeX CSS loaded via CDN in index.html
declare global {
  interface Window {
    katex: {
      render: (tex: string, element: HTMLElement, options?: object) => void;
    };
  }
}

interface ProofCardProps {
  title: string;
  formula: string;
  description: string;
  link?: string;
  linkText?: string;
}

function ProofCard({ title, formula, description, link, linkText }: ProofCardProps) {
  useEffect(() => {
    const element = document.getElementById(`formula-${title.replace(/\s/g, '-')}`);
    if (element && window.katex) {
      window.katex.render(formula, element, { throwOnError: false, displayMode: true });
    }
  }, [formula, title]);

  return (
    <div className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
      <h3 className="text-lg font-semibold text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors">
        {title}
      </h3>
      <div 
        id={`formula-${title.replace(/\s/g, '-')}`}
        className="bg-gradient-to-r from-slate-50 to-indigo-50 rounded-xl p-4 mb-4 text-center overflow-x-auto"
      />
      <p className="text-slate-600 text-sm leading-relaxed mb-4">{description}</p>
      {link && (
        <a 
          href={link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          {linkText || 'View Solution'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

interface WorkflowCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tags: string[];
}

function D3BollingerChart() {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Clear previous
    chartRef.current.innerHTML = "";

    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    svg.append("defs").append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    function addBollingerBands(data: any[], n: number, k: number) {
      let sum = 0; let sum2 = 0;
      for (let i = 0; i < Math.min(n - 1, data.length); i++) {
        data[i].mid = null; data[i].upper = null; data[i].lower = null;
        sum += data[i].close; sum2 += data[i].close ** 2;
      }
      for (let i = n - 1; i < data.length; i++) {
        const val = data[i].close;
        sum += val; sum2 += val ** 2;
        const mean = sum / n;
        const stddev = Math.sqrt((sum2 - (sum ** 2) / n) / (n - 1));
        data[i].mid = mean;
        data[i].upper = mean + (stddev * k);
        data[i].lower = mean - (stddev * k);
        const val0 = data[i - n + 1].close;
        sum -= val0; sum2 -= val0 ** 2;
      }
    }

    const dataUrl = "https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv";

    d3.csv(dataUrl).then(rawData => {
      const data = rawData.map((d: any) => ({
        date: new Date(d.Date),
        close: +d["AAPL.Close"]
      })).sort((a: any, b: any) => a.date - b.date);

      addBollingerBands(data, 20, 2);

      const xScale = d3.scaleTime()
        .domain(d3.extent(data, (d: any) => d.date) as [Date, Date])
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain([
          (d3.min(data, (d: any) => d.lower || d.close) || 0) * 0.95, 
          (d3.max(data, (d: any) => d.upper || d.close) || 0) * 1.05
        ])
        .range([height, 0]);

      const xAxis = svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

      svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).tickFormat((d: any) => "$" + d));

      const area = d3.area()
        .defined((d: any) => d.upper !== null && d.lower !== null)
        .x((d: any) => xScale(d.date))
        .y0((d: any) => yScale(d.lower))
        .y1((d: any) => yScale(d.upper));

      const lineMid = d3.line()
        .defined((d: any) => d.mid !== null)
        .x((d: any) => xScale(d.date))
        .y((d: any) => yScale(d.mid));

      const lineClose = d3.line()
        .x((d: any) => xScale(d.date))
        .y((d: any) => yScale(d.close));

      const lineGroup = svg.append("g")
        .attr("clip-path", "url(#clip)");

      lineGroup.append("path").datum(data).attr("fill", "lightsteelblue").attr("opacity", 0.3).attr("d", area as any);
      lineGroup.append("path").datum(data).attr("fill", "none").attr("stroke", "#999").attr("stroke-width", "1px").attr("stroke-dasharray", "4,4").attr("d", lineMid as any);
      lineGroup.append("path").datum(data).attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", "1.5px").attr("d", lineClose as any);

      const tooltip = d3.select(chartRef.current).append("div")
        .style("position", "absolute")
        .style("text-align", "left")
        .style("padding", "8px")
        .style("font", "12px sans-serif")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", "0");

      const focus = svg.append("g").style("display", "none");
      focus.append("circle").attr("fill", "steelblue").attr("stroke", "white").attr("stroke-width", "2px").attr("r", 5);
      const bisectDate = d3.bisector((d: any) => d.date).left;

      const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", updateChart);

      const brushGroup = svg.append("g")
        .attr("class", "brush")
        .call(brush)
        .on("mouseover", () => { focus.style("display", null); tooltip.style("opacity", "1"); })
        .on("mouseout", () => { focus.style("display", "none"); tooltip.style("opacity", "0"); })
        .on("mousemove", function(event) {
          const [mx, my] = d3.pointer(event, chartRef.current);
          const x0 = xScale.invert(d3.pointer(event, this)[0]);
          const i = bisectDate(data, x0, 1);
          const d0 = data[i - 1]; const d1 = data[i];
          let d = d0;
          if (d1) d = (+x0 - +d0.date) > (+d1.date - +x0) ? d1 : d0;

          focus.select("circle").attr("transform", `translate(${xScale(d.date)}, ${yScale(d.close)})`);
          tooltip.html(`
              <strong>${d.date.toLocaleDateString()}</strong><br>
              Close: $${d.close.toFixed(2)}<br>
              <span style="color:#aaa">Mid: $${((d as any).mid ? (d as any).mid.toFixed(2) : "N/A")}</span>
            `)
            .style("left", (mx + 15) + "px")
            .style("top", (my - 28) + "px");
        });

      function updateChart(event: any) {
        const extent = event.selection;
        if (!extent) return;
        xScale.domain([ xScale.invert(extent[0]), xScale.invert(extent[1]) ]);
        brushGroup.call(brush.move, null);
        xAxis.transition().duration(1000).call(d3.axisBottom(xScale) as any);
        lineGroup.select("path:nth-child(1)").transition().duration(1000).attr("d", area as any);
        lineGroup.select("path:nth-child(2)").transition().duration(1000).attr("d", lineMid as any);
        lineGroup.select("path:nth-child(3)").transition().duration(1000).attr("d", lineClose as any);
      }

      svg.on("dblclick", function() {
        xScale.domain(d3.extent(data, (d: any) => d.date) as [Date, Date]);
        xAxis.transition().duration(1000).call(d3.axisBottom(xScale) as any);
        lineGroup.select("path:nth-child(1)").transition().duration(1000).attr("d", area as any);
        lineGroup.select("path:nth-child(2)").transition().duration(1000).attr("d", lineMid as any);
        lineGroup.select("path:nth-child(3)").transition().duration(1000).attr("d", lineClose as any);
      });
    });
  }, []);

  return <div ref={chartRef} className="relative overflow-x-auto" style={{ width: '100%', height: '420px' }}></div>;
}

function WorkflowCard({ icon, title, description, tags }: WorkflowCardProps) {
  return (
    <div className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-emerald-200 transition-all duration-300">
      <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed mb-4">{description}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span 
            key={index}
            className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState<'workflows' | 'proofs'>('workflows');
  const [katexLoaded, setKatexLoaded] = useState(false);

  useEffect(() => {
    // Load KaTeX CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(link);

    // Load KaTeX JS
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    script.async = true;
    script.onload = () => setKatexLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  const proofs: ProofCardProps[] = [
    {
      title: "Limit of 1/x³ at x=2",
      formula: "\\lim_{x\\to 2} \\frac{1}{x^3} = \\frac{1}{8}",
      description: "Rigorous proof using the formal definition of a limit. We analyze the behavior as x approaches the constant a.",
    },
    {
      title: "General Limit of 1/x",
      formula: "\\lim_{x \\to a} \\frac{1}{x} = \\frac{1}{a}",
      description: "Exploration of the ε-δ relationship for rational functions.",
      link: "https://math.stackexchange.com/questions/1872265/epsilon-delta-proof-lim-limits-x-to-a-frac1x-frac1a",
      linkText: "View Detailed Solution"
    },
    {
      title: "Rational Function Proof",
      formula: "\\lim_{x\\rightarrow -2} \\frac{x-1}{x+1}=3",
      description: "Application of the triangle inequality and bounding techniques for denominators near a point.",
      link: "https://math.stackexchange.com/questions/1187971/using-epsilon-delta-definition-to-prove-that-lim-x-to-2-fracx-1x1",
      linkText: "Discussion Thread"
    },
    {
      title: "The Unit Case",
      formula: "\\lim_{x \\to 1} \\frac{1}{x} = 1",
      description: "A simplified case study highlighting the fundamental mechanics of the limit definition.",
      link: "https://math.stackexchange.com/questions/418961/epsilon-delta-proof-that-lim-limits-x-to-1-frac1x-1",
      linkText: "Step-by-Step Breakdown"
    }
  ];

  const workflows: WorkflowCardProps[] = [
    {
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      title: "Automated Data Pipeline",
      description: "End-to-end data processing workflow with validation, transformation, and storage.",
      tags: ["Python", "ETL", "Automation"]
    },
    {
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      title: "CI/CD Automation Pipeline",
      description: "Automated testing, building, and deployment with rollback capabilities using industry standard tooling.",
      tags: ["GitHub Actions", "Docker", "AWS"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl text-slate-800">PillowDash</span>
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setActiveSection('workflows')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === 'workflows'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Workflows
              </button>
              <button
                onClick={() => setActiveSection('proofs')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === 'proofs'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Proofs
              </button>
            </nav>
            <a 
              href="https://github.com/pillowdash" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              Portfolio & Mathematical Proofs
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Exploring the Beauty of
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Mathematics</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10">
              A collection of rigorous ε-δ proofs, automated workflows, and technical explorations. 
              Bridging theory with practical applications.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => setActiveSection('workflows')}
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Explore Workflows
              </button>
              <button 
                onClick={() => setActiveSection('proofs')}
                className="px-6 py-3 bg-white text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors border border-slate-200"
              >
                View Proofs
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Navigation */}
      <div className="sm:hidden sticky top-16 z-40 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection('workflows')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'workflows'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 bg-slate-100'
            }`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveSection('proofs')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'proofs'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 bg-slate-100'
            }`}
          >
            Proofs
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Proofs Section */}
        {activeSection === 'proofs' && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Calculus: ε-δ Proofs</h2>
                <p className="text-slate-500 text-sm">Rigorous mathematical proofs using formal definitions</p>
              </div>
            </div>
            
            {katexLoaded ? (
              <div className="grid md:grid-cols-2 gap-6">
                {proofs.map((proof, index) => (
                  <ProofCard key={index} {...proof} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-slate-500">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading mathematical notation...
                </div>
              </div>
            )}

            {/* Bottom navigation buttons */}
            <div className="mt-12 text-center flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => setActiveSection('workflows')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg transform transition-all duration-300"
              >
                <span>Explore Workflows</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button 
                onClick={() => setActiveSection('proofs')}
                className="inline-flex items-center gap-2 bg-white/50 text-indigo-600 border-2 border-indigo-300 px-8 py-4 rounded-full font-semibold hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:text-white hover:border-transparent transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>View Proofs</span>
              </button>
            </div>
          </section>
        )}

        {/* Workflows Section */}
        {activeSection === 'workflows' && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Workflows & Automation</h2>
                <p className="text-slate-500 text-sm">Technical projects and automated systems</p>
              </div>
            </div>

            {/* AI Automation Workflows Section */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18l-1.5 1.5h9L15 18l-.813-2.096M4 6h16M7 6V4h10v2m-9 6h.01M12 10h.01M16 10h.01M9 14h6m-7 7h8a2 2 0 002-2V8H6v11a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">AI Automation</h3>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-cyan-200 transition-all duration-300">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3v2.25M14.25 3v2.25M4.5 9.75h15M6.75 6.75h10.5A2.25 2.25 0 0119.5 9v8.25a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25V9A2.25 2.25 0 016.75 6.75z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13.5h6M9 16.5h3.75" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 mb-1">n8n + Supabase AI RAG Workflow</h4>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      Agentic RAG workflow with vector retrieval, persistent memory, and tool-driven decisioning with{' '}
                      <a
                        href="https://n8n.io/ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
                      >
                        n8n
                      </a>{' '}
                      and{' '}
                      <a
                        href="https://openai.com/api/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
                      >
                        OpenAI API
                      </a>
                    </p>
                    <ul className="text-slate-600 text-sm leading-relaxed list-disc pl-5 space-y-1">
                      <li>
                        Local{' '}
                        <a
                          href="https://supabase.com/modules/vector"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
                        >
                          Supabase
                        </a>{' '}
                        and n8n setup
                      </li>
                      <li>Document ingestion pipeline with OpenAI text embeddings</li>
                      <li>Storing content and vectors in Supabase</li>
                      <li>Building a chat workflow using AI Agent with memory and vector retrieval</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-cyan-50 rounded-xl p-4 mb-4">
                  <img
                    src="img/RAG_with_n8n.webp"
                    alt="n8n and Supabase AI RAG workflow diagram"
                    className="w-full rounded-lg shadow-sm border border-slate-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.parentElement!.innerHTML = `
                        <div class="flex items-center justify-center h-48 text-slate-400">
                          <svg class="w-12 h-12 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <span>Workflow diagram will appear here</span>
                        </div>
                      `;
                    }}
                  />
                  <p className="text-slate-500 text-xs mt-3 text-center italic">
                    Figure 1: Agentic RAG workflow connecting document ingestion, vector storage, and semantic vector retrieval.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">n8n</span>
                    <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">Vector Store</span>
                    <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">AI Agent</span>
                    <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">Agentic RAG</span>
                  </div>
                  <a
                    href="https://youtu.be/xYkyasMv7LM"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Watch Demo
                  </a>
                </div>

                <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-cyan-200 hover:shadow-lg hover:border-cyan-200 transition-all duration-300">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17.25h4.5M12 3v2.25m6.364 1.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-2.227-1.591 1.591M5.25 12H3m4.227-5.364L5.636 5.045M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h5 className="text-base font-semibold text-slate-800 mb-1">Local OpenClaw AI Agent</h5>
                      <p className="text-slate-600 text-sm leading-relaxed mb-3">
                        Building a local autonomous AI agent with OpenClaw powered by local Qwen3 LLM.
                      </p>
                      <div className="text-slate-600 text-sm leading-relaxed">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Integration with local Qwen LLM</li>
                          <li>
                            Integrated with{' '}
                            <a
                              href="https://brave.com/search/api/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
                            >
                              Brave Search API
                            </a>
                          </li>
                          <li>Discord messaging integration</li>
                        </ul>
                        <p className="mt-3">
                          This setup creates a practical, privacy-focused AI agent that can understand instructions and act directly on your local machine.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-cyan-100">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">OpenClaw</span>
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">Brave API</span>
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">Local LLM</span>
                    </div>
                    <a
                      href="https://youtu.be/3L9tZXr1AB8"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Watch Demo
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Robotic Process Automation Section */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">Robotic Process Automation</h3>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 mb-2">Automation Anywhere Bot</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Developing scalable solutions using the{' '}
                      <a 
                        href="https://www.automationanywhere.com/products/enterprise/community-edition" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
                      >
                        Automation Anywhere Community Edition
                      </a>. 
                      This workflow demonstrates process logic for data handling.
                    </p>
                  </div>
                </div>
                
                {/* Workflow Diagram Image */}
                <div className="bg-gradient-to-r from-slate-50 to-orange-50 rounded-xl p-4 mb-4">
                  <img 
                    src="img/automationAnywhere.webp" 
                    alt="Automation Anywhere Workflow Diagram" 
                    className="w-full rounded-lg shadow-sm border border-slate-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.parentElement!.innerHTML = `
                        <div class="flex items-center justify-center h-48 text-slate-400">
                          <svg class="w-12 h-12 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <span>Workflow diagram will appear here</span>
                        </div>
                      `;
                    }}
                  />
                  <p className="text-slate-500 text-xs mt-3 text-center italic">
                    Figure 2: Visual representation of the logic flow and bot structure.
                  </p>
                </div>
                
                {/* Tags and Links */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">RPA</span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">Automation Anywhere</span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">Bot Development</span>
                  </div>
                  <a 
                    href="https://www.youtube.com/watch?v=mMaWTqTFM4w" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Watch Demo
                  </a>
                </div>
              </div>
            </div>

            {/* WooCommerce Workflows Section */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 11h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">WooCommerce Workflows</h3>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-purple-200 transition-all duration-300">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 mb-1"><a href="https://woocommerce.com/" 
                           target="_blank" rel="noopener noreferrer"
                           className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors">WooCommerce</a> Transaction Workflow (Stripe Integration)</h4>
                    <p className="text-slate-600 text-sm">Develop and test a complete e-commerce transaction flow, including payment processing, refund handling, and promotional logic. This workflow ensures accurate synchronization between WooCommerce, <a href="https://docs.stripe.com/sandboxes" 
                           target="_blank" rel="noopener noreferrer"
                           className="font-semibold text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors">Stripe</a> Sandbox, and backend database systems.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">WooCommerce</span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">E-commerce</span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Workflow</span>
                  </div>
                  <div className="flex justify-start">
                    <a 
                      href="https://youtu.be/Aimd1kfL0-8" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Watch Demo
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Dashboard Section */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">Analytics Dashboard</h3>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 mb-2">Apple Stock (AAPL) - Bollinger Bands</h4>
                    <p className="text-slate-600 text-sm">Interactive D3.js chart using Bollinger Bands algorithm. Brush/select a region to zoom in. Double click to reset.</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-4 h-[440px]">
                  <D3BollingerChart />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">React</span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">D3.js</span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">API</span>
                </div>
              </div>
            </div>



            {/* Other Projects Section */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800">Other Projects</h3>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workflows.map((workflow, index) => (
                <WorkflowCard key={index} {...workflow} />
              ))}
            </div>

            {/* Bottom navigation buttons */}
            <div className="mt-12 text-center flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => setActiveSection('workflows')}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg transform transition-all duration-300"
              >
                <span>Explore Workflows</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button 
                onClick={() => setActiveSection('proofs')}
                className="inline-flex items-center gap-2 bg-white/50 text-indigo-600 border-2 border-indigo-300 px-8 py-4 rounded-full font-semibold hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:text-white hover:border-transparent transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                <span>View Proofs</span>
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl">PillowDash</span>
            </div>
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} PillowDash. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/pillowdash" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
