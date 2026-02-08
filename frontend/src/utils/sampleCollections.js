// Bundled sample paper collections for the Add Papers panel
// Query format matches bulkFetchPapers: { filter, label, pages }

export const SAMPLE_COLLECTIONS = [
  {
    id: 'top-ai',
    label: 'Top AI Papers',
    description: '50 landmark papers: Transformers, GPT, BERT, diffusion models, RL',
    type: 'seed',
  },
  {
    id: 'biology',
    label: 'Biology & Medicine',
    description: 'CRISPR, protein folding, mRNA vaccines, single-cell RNA-seq',
    type: 'openalex',
    queries: [
      { filter: 'default.search:CRISPR gene editing', label: 'CRISPR', pages: 2 },
      { filter: 'default.search:protein structure prediction AlphaFold', label: 'Protein Folding', pages: 2 },
      { filter: 'default.search:mRNA vaccine immunology', label: 'mRNA Vaccines', pages: 1 },
      { filter: 'default.search:single cell RNA sequencing', label: 'scRNA-seq', pages: 1 },
    ],
  },
  {
    id: 'physics',
    label: 'Quantum & Physics',
    description: 'Quantum computing, gravitational waves, topological materials',
    type: 'openalex',
    queries: [
      { filter: 'default.search:quantum computing qubit error correction', label: 'Quantum Computing', pages: 2 },
      { filter: 'default.search:gravitational waves LIGO detection', label: 'Gravitational Waves', pages: 1 },
      { filter: 'default.search:topological insulators quantum materials', label: 'Topological Materials', pages: 1 },
    ],
  },
  {
    id: 'climate',
    label: 'Climate & Energy',
    description: 'Climate modeling, solar cells, batteries, carbon capture',
    type: 'openalex',
    queries: [
      { filter: 'default.search:climate change modeling prediction', label: 'Climate Modeling', pages: 2 },
      { filter: 'default.search:perovskite solar cell efficiency', label: 'Solar Cells', pages: 1 },
      { filter: 'default.search:lithium ion battery solid state', label: 'Batteries', pages: 1 },
      { filter: 'default.search:carbon capture utilization storage', label: 'Carbon Capture', pages: 1 },
    ],
  },
  {
    id: 'neuro',
    label: 'Neuroscience',
    description: 'Connectomics, optogenetics, brain-computer interfaces',
    type: 'openalex',
    queries: [
      { filter: 'default.search:brain connectome neural circuits', label: 'Connectomics', pages: 2 },
      { filter: 'default.search:optogenetics neural activity control', label: 'Optogenetics', pages: 1 },
      { filter: 'default.search:brain computer interface decoding', label: 'BCI', pages: 1 },
    ],
  },
  {
    id: 'full-import',
    label: 'Full OpenAlex Import',
    description: '~5,000 papers across 10 fields (takes 30-60 seconds)',
    type: 'openalex-full',
  },
];
