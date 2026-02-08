import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FadeIn } from '@/components/ui/fade-in';

function SubmitPaper({ contracts, account, importData }) {
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    doi: '',
    ipfsHash: '',
  });

  useEffect(() => {
    if (importData) {
      setFormData(prev => ({
        ...prev,
        title: importData.title || prev.title,
        abstract: importData.abstract || prev.abstract,
        doi: importData.doi || prev.doi,
      }));
      setMessage({ type: 'info', text: `Paper data synchronized from Knowledge Graph.` });
    }
  }, [importData]);

  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handlePdfSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
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
      setMessage({ type: 'info', text: 'Preparing launch...' });

      const mockIpfsHash = formData.ipfsHash || 'Qm' + Math.random().toString(36).substring(7);
      const submissionFee = await contracts.researchGraph.submissionFeeUSD();

      setMessage({ type: 'info', text: `Authorizing ${ethers.formatUnits(submissionFee, 6)} USDC on Plasma...` });

      const approveTx = await contracts.usdc.approve(
        await contracts.researchGraph.getAddress(),
        submissionFee
      );
      await approveTx.wait();

      setMessage({ type: 'info', text: 'Launching research to the Graph...' });

      const submitTx = await contracts.researchGraph.submitPaper(mockIpfsHash, formData.doi);
      const receipt = await submitTx.wait();

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
        text: `RESEARCH LAUNCHED. ID: ${paperId}. Verification markets are now OPEN.`
      });

      setFormData({ title: '', abstract: '', doi: '', ipfsHash: '' });
    } catch (error) {
      console.error('Launch error:', error);
      setMessage({
        type: 'error',
        text: error.reason || error.message || 'Failed to launch research'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <FadeIn>
        <span className="section-label mb-2 block text-neutral-400">Main Track: New Consumer Primitives</span>
        <h2 className="section-title mb-2 italic">Launch Research</h2>
        <p className="body-text text-sm mb-8 font-light italic text-neutral-500">
          Transform your knowledge into a liquid asset. Launch your findings to the decentralized research graph. 
          Instant verification via Flare FDC. Instant liquidity via Plasma USDC.
        </p>
      </FadeIn>

      {message.text && (
        <Alert
          variant={message.type === 'error' ? 'destructive' : message.type === 'success' ? 'success' : 'default'}
          className={`mb-6 rounded-none ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}`}
        >
          <AlertDescription className="font-mono text-xs">{message.text}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PDF Upload */}
        <FadeIn delay={0.1}>
          {!pdfFile ? (
            <label className="flex flex-col items-center justify-center border border-dashed border-neutral-300 p-12 cursor-pointer hover:border-neutral-900 transition-all bg-neutral-50/50">
              <input type="file" accept=".pdf" onChange={handlePdfSelect} className="hidden" />
              <Upload className="h-6 w-6 text-neutral-300 mb-3 group-hover:text-neutral-900" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Select Manuscript PDF</span>
              <span className="text-[10px] text-neutral-400 mt-2 italic">Decentralized storage via IPFS</span>
            </label>
          ) : (
            <div className="flex items-center gap-4 border border-neutral-900 p-5 bg-neutral-900 text-white">
              <FileText className="h-5 w-5 text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate font-mono">{pdfFile.name}</div>
                <div className="text-[10px] text-neutral-500 font-mono">{formatFileSize(pdfFile.size)}</div>
              </div>
              <button type="button" onClick={removePdf} className="text-neutral-500 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FadeIn delay={0.15} className="md:col-span-2">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Research Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="The next paradigm shift in..."
                required
                className="rounded-none border-neutral-200 focus:border-neutral-900"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.2} className="md:col-span-2">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Abstract (Pitch)</label>
              <Textarea
                value={formData.abstract}
                onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                placeholder="Why does this research matter? What is the core breakthrough?"
                required
                className="min-h-[140px] rounded-none border-neutral-200 focus:border-neutral-900 font-serif leading-relaxed"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">DOI Reference</label>
              <Input
                value={formData.doi}
                onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                placeholder="10.1234/example.2024"
                className="rounded-none border-neutral-200 focus:border-neutral-900"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Content Identifier</label>
              <Input
                value={formData.ipfsHash}
                onChange={(e) => setFormData({ ...formData, ipfsHash: e.target.value })}
                placeholder="IPFS_CONTENT_HASH"
                className="rounded-none border-neutral-200 font-mono text-xs italic bg-neutral-50"
              />
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.35}>
          <div className="border border-neutral-100 p-6 bg-neutral-50/50 space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 block underline underline-offset-4">Protocol Launch Sequence</span>
            <ul className="space-y-2 text-[11px] text-neutral-500 font-mono italic">
              <li className="flex items-center gap-2"><div className="h-1 w-1 bg-neutral-400" /> Verify DOI via Flare Data Connector</li>
              <li className="flex items-center gap-2"><div className="h-1 w-1 bg-neutral-400" /> Random reviewer assignment via Flare RNG</li>
              <li className="flex items-center gap-2"><div className="h-1 w-1 bg-neutral-400" /> Settle submission fees via Plasma USDC</li>
              <li className="flex items-center gap-2"><div className="h-1 w-1 bg-neutral-400" /> Initialize LMSR truth discovery market</li>
            </ul>
          </div>
        </FadeIn>

        <FadeIn delay={0.4}>
          <Button
            type="submit"
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-widest h-14 rounded-none transition-all hover:tracking-[0.2em]"
            disabled={loading}
          >
            {loading ? 'INITIATING LAUNCH...' : 'LAUNCH RESEARCH — $50 USDC'}
          </Button>
        </FadeIn>
      </form>
    </div>
  );
}

export default SubmitPaper;
