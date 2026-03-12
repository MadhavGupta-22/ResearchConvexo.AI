import React, { useRef, useEffect, useState } from 'react';
import './Dashboard-2.css';

// ── Markdown-lite parser ──
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
  return html;
}

function MarkdownText({ children }) {
  if (!children) return null;
  return <span dangerouslySetInnerHTML={{ __html: parseMarkdown(children) }} />;
}

export default function Dashboard2({ analysisResult, onBack, userProfile }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo(0, 0);
    }
  }, [activeTab]);

  if (!analysisResult) {
    return (
      <div className="d2-page">
        <div className="d2-bg-effects" />
        <div className="d2-empty-state">
          <div className="d2-empty-icon-wrap">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2>No Analysis Data</h2>
          <p>Return and run an analysis first.</p>
          <button className="d2-back-btn" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>
    );
  }

  const {
    summary = '',
    key_insights = [],
    gaps = [],
    ideas = [],
    papers_found = 0,
    analysis_mode = 'abstract_based',
    papers_metadata = [],
    visible_tabs = ['summary', 'insights', 'papers'],
  } = analysisResult;

  const ALL_TABS = [
    { id: 'summary', label: 'Summary', icon: 'S', count: null },
    { id: 'insights', label: 'Insights', icon: 'I', count: key_insights.length },
    { id: 'gaps', label: 'Gaps', icon: 'G', count: gaps.length },
    { id: 'papers', label: 'Papers', icon: 'P', count: papers_metadata.length },
    { id: 'ideas', label: 'Ideas', icon: 'R', count: ideas.length },
  ];

  const tabs = ALL_TABS.filter((tab) => visible_tabs.includes(tab.id));

  useEffect(() => {
    if (!visible_tabs.includes(activeTab)) {
      setActiveTab('summary');
    }
  }, [visible_tabs, activeTab]);

  const renderSummary = () => {
    const paragraphs = summary.split('\n').filter((p) => p.trim());
    return (
      <div className="d2-summary-content">
        <div className="d2-section-card">
          {paragraphs.map((para, i) => {
            const trimmed = para.trim();

            if (trimmed.startsWith('### ')) {
              const clean = trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '');
              return <h4 key={i} className="d2-sub-heading">{clean}</h4>;
            }
            if (trimmed.startsWith('## ')) {
              const clean = trimmed.replace(/^##\s*/, '').replace(/\*\*/g, '');
              return <h3 key={i} className="d2-section-heading">{clean}</h3>;
            }
            if (trimmed.startsWith('# ')) {
              const clean = trimmed.replace(/^#\s*/, '').replace(/\*\*/g, '');
              return <h2 key={i} className="d2-main-heading">{clean}</h2>;
            }

            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              return (
                <div key={i} className="d2-bullet-item">
                  <span className="d2-bullet-dot" />
                  <span><MarkdownText>{trimmed.replace(/^[-*]\s/, '')}</MarkdownText></span>
                </div>
              );
            }

            if (/^\d+\.\s/.test(trimmed)) {
              const num = trimmed.match(/^(\d+)\./)[1];
              const text = trimmed.replace(/^\d+\.\s*/, '');
              return (
                <div key={i} className="d2-numbered-item">
                  <span className="d2-numbered-num">{num}</span>
                  <span><MarkdownText>{text}</MarkdownText></span>
                </div>
              );
            }

            if (/^\*\*.+\*\*:?\s*$/.test(trimmed)) {
              const clean = trimmed.replace(/\*\*/g, '').replace(/:$/, '');
              return <h4 key={i} className="d2-inline-heading">{clean}</h4>;
            }

            return (
              <p key={i} className="d2-paragraph">
                <MarkdownText>{trimmed}</MarkdownText>
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInsights = () => (
    <div className="d2-list-content">
      {key_insights.length === 0 ? (
        <div className="d2-no-data">No insights extracted.</div>
      ) : (
        key_insights.map((insight, i) => (
          <div key={i} className="d2-insight-card" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="d2-insight-number">{String(i + 1).padStart(2, '0')}</div>
            <div className="d2-insight-text"><MarkdownText>{insight}</MarkdownText></div>
          </div>
        ))
      )}
    </div>
  );

  const renderGaps = () => (
    <div className="d2-list-content">
      {gaps.length === 0 ? (
        <div className="d2-no-data">No research gaps identified.</div>
      ) : (
        gaps.map((gap, i) => (
          <div key={i} className="d2-gap-card" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="d2-gap-icon">!</div>
            <div className="d2-gap-text"><MarkdownText>{gap}</MarkdownText></div>
          </div>
        ))
      )}
    </div>
  );

  const renderPapers = () => (
    <div className="d2-papers-content">
      {papers_metadata.length === 0 ? (
        <div className="d2-no-data">No paper metadata available.</div>
      ) : (
        papers_metadata.map((paper, i) => (
          <div key={i} className="d2-paper-card" style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="d2-paper-index">{i + 1}</div>
            <div className="d2-paper-info">
              <div className="d2-paper-title">{(paper.title || 'Untitled').replace(/\*\*/g, '')}</div>
              {paper.authors && paper.authors.length > 0 && (
                <div className="d2-paper-authors">
                  {paper.authors.slice(0, 3).join(', ')}
                  {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
                </div>
              )}
              <div className="d2-paper-meta-row">
                {paper.year && <span className="d2-paper-meta-tag">{paper.year}</span>}
                {paper.source && <span className="d2-paper-meta-tag">{paper.source}</span>}
                {paper.citation_count != null && (
                  <span className="d2-paper-meta-tag">{paper.citation_count} cites</span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderIdeas = () => (
    <div className="d2-list-content">
      {ideas.length === 0 ? (
        <div className="d2-no-data">No research ideas generated.</div>
      ) : (
        ideas.map((idea, i) => (
          <div key={i} className="d2-idea-card" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="d2-idea-icon">✦</div>
            <div className="d2-idea-text"><MarkdownText>{idea}</MarkdownText></div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="d2-page">
      <div className="d2-bg-effects" />

      {/* ═══ Sidebar — Chat History ═══ */}
      <aside className={`d2-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="d2-sidebar-header">
          <div className="d2-sidebar-logo">
            {/* Stacked layers logo matching the image */}
            <div className="d2-logo-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M2 16.5L12 22L22 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
                <path d="M2 12L12 17.5L22 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                <path d="M12 2L2 7.5L12 13L22 7.5L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="rgba(129,140,248,0.1)" />
              </svg>
            </div>
            {!sidebarCollapsed && <span className="d2-sidebar-logo-text">Aurora.ai</span>}
          </div>
          <button
            className="d2-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* New Analysis Button */}
            <button className="d2-sidebar-new-btn" onClick={onBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Analysis
            </button>

            {/* Chat History Section */}
            <div className="d2-sidebar-section-label">Chat History</div>

            <div className="d2-chat-history-empty">
              {/* Chat bubble illustration */}
              <div className="d2-chat-empty-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" opacity="0.4" />
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeWidth="1.5" />
                  <line x1="8" y1="8" x2="16" y2="8" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                  <line x1="8" y1="11" x2="14" y2="11" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                  <line x1="8" y1="14" x2="11" y2="14" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                </svg>
              </div>

              <span className="d2-chat-empty-badge">Coming Soon</span>
              <span className="d2-chat-empty-title">No conversations yet</span>
              <span className="d2-chat-empty-desc">
                Your past analyses and conversations will appear here for easy access.
              </span>

              {/* Placeholder skeleton items */}
              <div className="d2-chat-skeleton-list">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="d2-chat-skeleton-item" style={{ opacity: 1 - i * 0.25 }}>
                    <div className="d2-chat-skeleton-dot" />
                    <div className="d2-chat-skeleton-lines">
                      <div className="d2-chat-skeleton-line long" />
                      <div className="d2-chat-skeleton-line short" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Collapsed state — just show chat icon */}
        {sidebarCollapsed && (
          <div className="d2-sidebar-collapsed-icons">
            <button className="d2-sidebar-collapsed-btn" onClick={onBack} title="New Analysis">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button className="d2-sidebar-collapsed-btn disabled" title="Chat History — Coming Soon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
          </div>
        )}

        <div className="d2-sidebar-footer">
          <button
            className={sidebarCollapsed ? 'd2-sidebar-back-icon' : 'd2-sidebar-back-btn'}
            onClick={onBack}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {!sidebarCollapsed && 'Back to Dashboard'}
          </button>
        </div>
      </aside>

      {/* ═══ Main ═══ */}
      <div className={`d2-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="d2-topbar">
          <div className="d2-topbar-left">
            <h1 className="d2-topbar-title">Results</h1>
            <div className="d2-topbar-mode">
              {analysis_mode === 'full_text' ? 'Full Text' : 'Abstract'}
            </div>
          </div>
          <div className="d2-topbar-right">
            <div className="d2-status-badge">
              <span className="d2-status-dot" />
              Complete
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="d2-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`d2-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="d2-tab-icon">{tab.icon}</span>
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="d2-tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="d2-content" ref={contentRef}>
          <div className="d2-content-inner">
            {activeTab === 'summary' && renderSummary()}
            {activeTab === 'insights' && renderInsights()}
            {activeTab === 'gaps' && renderGaps()}
            {activeTab === 'papers' && renderPapers()}
            {activeTab === 'ideas' && renderIdeas()}
          </div>
        </div>
      </div>
    </div>
  );
}