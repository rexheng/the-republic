import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function SubmitPaper({ contracts, account, importData }) {
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    doi: '',
    ipfsHash: '',
  });

  // Pre-fill form when importing from Knowledge Graph
  useEffect(() => {
    if (importData) {
      setFormData(prev => ({
        ...prev,
        title: importData.title || prev.title,
        abstract: importData.abstract || prev.abstract,
        doi: importData.doi || prev.doi,
      }));
      setMessage({ type: 'info', text: `Imported "${importData.title}" from Knowledge Graph. Fill in any missing details and submit.` });
    }
  }, [importData]);
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handlePdfSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      // Generate mock IPFS hash from filename
      const mockHash = 'Qm' + btoa(file.name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 44);
      setFormData(prev => ({ ...prev, ipfsHash: mockHash }));
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setFormData(prev => ({ ...prev, ipfsHash: '' }));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!contracts.researchGraph || !contracts.usdc) {
      setMessage({ type: 'error', text: 'Contracts not initialized' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: 'info', text: 'Preparing submission...' });

      // For demo, simulate IPFS upload
      const mockIpfsHash = formData.ipfsHash || 'Qm' + Math.random().toString(36).substring(7);

      // Get submission fee
      const submissionFee = await contracts.researchGraph.submissionFeeUSD();

      setMessage({ type: 'info', text: `Approving ${ethers.formatUnits(submissionFee, 6)} USDC...` });

      // Approve USDC spending
      const approveTx = await contracts.usdc.approve(
        await contracts.researchGraph.getAddress(),
        submissionFee
      );
      await approveTx.wait();

      setMessage({ type: 'info', text: 'Submitting paper to blockchain...' });

      // Submit paper
      const submitTx = await contracts.researchGraph.submitPaper(
        mockIpfsHash,
        formData.doi
      );
      const receipt = await submitTx.wait();

      // Get paper ID from event
      const event = receipt.logs.find(log => {
        try {
          return contracts.researchGraph.interface.parseLog(log)?.name === 'PaperSubmitted';
        } catch {
          return false;
        }
      });

      const paperId = event ? contracts.researchGraph.interface.parseLog(event).args.paperId : 'N/A';

      setMessage({
        type: 'success',
        text: `Paper submitted successfully! Paper ID: ${paperId}. External verification via Flare FDC initiated.`
      });

      // Reset form
      setFormData({ title: '', abstract: '', doi: '', ipfsHash: '' });

    } catch (error) {
      console.error('Submission error:', error);
      setMessage({
        type: 'error',
        text: error.reason || error.message || 'Failed to submit paper'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Submit Research Paper</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Submit your paper to the decentralized research graph. You'll need to pay a $50 USDC submission fee (Plasma network).
      </p>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* PDF Upload */}
        {!pdfFile ? (
          <label className="pdf-upload">
            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfSelect}
              style={{ display: 'none' }}
            />
            <div className="pdf-upload-icon">PDF</div>
            <div className="pdf-upload-text">Click to attach your paper PDF</div>
            <div className="pdf-upload-hint">Will be stored on IPFS (decentralized storage)</div>
          </label>
        ) : (
          <div className="pdf-upload-info">
            <span className="pdf-upload-info-icon">PDF</span>
            <div>
              <div className="pdf-upload-info-name">{pdfFile.name}</div>
              <div className="pdf-upload-info-size">{formatFileSize(pdfFile.size)}</div>
            </div>
            <button type="button" className="pdf-upload-info-remove" onClick={removePdf}>
              &times;
            </button>
          </div>
        )}

        <div className="form-group">
          <label>Paper Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter your paper title"
            required
          />
        </div>

        <div className="form-group">
          <label>Abstract *</label>
          <textarea
            value={formData.abstract}
            onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
            placeholder="Enter your paper abstract"
            required
          />
        </div>

        <div className="form-group">
          <label>DOI (Digital Object Identifier)</label>
          <input
            type="text"
            value={formData.doi}
            onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
            placeholder="10.1234/example.2024"
          />
          <small style={{ color: '#666', fontSize: '0.85rem' }}>
            If provided, we'll verify your paper via Flare Data Connector (CrossRef API)
          </small>
        </div>

        <div className="form-group">
          <label>IPFS Hash (optional - will auto-generate for demo)</label>
          <input
            type="text"
            value={formData.ipfsHash}
            onChange={(e) => setFormData({ ...formData, ipfsHash: e.target.value })}
            placeholder="QmXYZ123..."
          />
        </div>

        <div style={{
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>What happens next?</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px', color: '#666' }}>
            <li>Your paper is submitted to IPFS (decentralized storage)</li>
            <li>Flare FDC verifies external data (DOI, citations)</li>
            <li>Random reviewers are assigned via Flare RNG</li>
            <li>Reviewers earn $100 USDC (Plasma) per review</li>
            <li>If accepted, you earn RESEARCH governance tokens</li>
          </ul>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-large"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Submitting...' : 'Submit Paper (50 USDC)'}
        </button>
      </form>
    </div>
  );
}

export default SubmitPaper;
