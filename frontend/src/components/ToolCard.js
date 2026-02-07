import React, { useState } from 'react';

function ToolCard({ tool }) {
  const [expanded, setExpanded] = useState(false);

  const exampleCall = {
    tool: tool.name,
    arguments: Object.fromEntries(
      Object.entries(tool.inputSchema.properties || {}).slice(0, 3).map(([key, val]) => {
        if (val.type === 'string') return [key, val.enum ? val.enum[0] : `<${key}>` ];
        if (val.type === 'number') return [key, val.enum ? val.enum[0] : 0];
        if (val.type === 'boolean') return [key, true];
        if (val.type === 'array') return [key, []];
        return [key, null];
      })
    ),
  };

  const jsonStr = JSON.stringify(exampleCall, null, 2);

  return (
    <div className="tool-card">
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-card-name">
          <span className="tool-card-icon">fn</span>
          {tool.name}
        </div>
        <span className={`tool-card-expand ${expanded ? 'expanded' : ''}`}>
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </div>
      <p className="tool-card-desc">{tool.description}</p>

      {expanded && (
        <div className="tool-card-details">
          <div className="tool-card-section">
            <span className="tool-card-section-label">Parameters</span>
            <div className="tool-card-params">
              {Object.entries(tool.inputSchema.properties || {}).map(([name, prop]) => (
                <div key={name} className="tool-card-param">
                  <code className="tool-card-param-name">{name}</code>
                  <span className="tool-card-param-type">{prop.type}{prop.enum ? ` [${prop.enum.join('|')}]` : ''}</span>
                  {(tool.inputSchema.required || []).includes(name) && (
                    <span className="tool-card-param-required">required</span>
                  )}
                  <span className="tool-card-param-desc">{prop.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="tool-card-section">
            <span className="tool-card-section-label">Returns</span>
            <code className="tool-card-return">{tool.returnType}</code>
          </div>

          <div className="tool-card-section">
            <span className="tool-card-section-label">Example Call</span>
            <pre className="tool-card-code">
              <code>{jsonStr}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolCard;
