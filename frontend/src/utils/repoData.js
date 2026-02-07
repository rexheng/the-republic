// Bundled mapping: seed paper IDs → real GitHub repos + pre-computed MCP tool definitions
// Enables the Paper2Agent "Make Runnable" flow without a Python backend

const REPO_DATA = {
  vaswani2017: {
    owner: 'tensorflow',
    name: 'tensor2tensor',
    url: 'https://github.com/tensorflow/tensor2tensor',
    stars: 15200,
    description: 'Library of deep learning models and datasets designed to make deep learning more accessible',
    language: 'Python',
    topics: ['transformer', 'attention', 'deep-learning', 'nlp'],
    detectedFiles: {
      entryPoints: ['tensor2tensor/bin/t2t_trainer.py', 'tensor2tensor/bin/t2t_decoder.py'],
      notebooks: ['tensor2tensor/notebooks/hello_t2t.ipynb'],
      modelFiles: ['tensor2tensor/models/transformer.py', 'tensor2tensor/layers/common_attention.py'],
      configs: ['tensor2tensor/models/transformer.py'],
      dependencies: ['tensorflow>=1.15', 'numpy', 'scipy', 'sympy'],
    },
    mcpTools: [
      {
        name: 'train_transformer',
        description: 'Train a Transformer model on a specified problem/dataset',
        inputSchema: {
          type: 'object',
          properties: {
            problem: { type: 'string', description: 'Problem name (e.g., translate_ende_wmt32k)' },
            model: { type: 'string', description: 'Model name (e.g., transformer)' },
            hparams_set: { type: 'string', description: 'Hyperparameter set (e.g., transformer_base)' },
            train_steps: { type: 'number', description: 'Number of training steps' },
          },
          required: ['problem', 'model'],
        },
        returnType: 'TrainingResult with loss, metrics, checkpoint path',
      },
      {
        name: 'decode_text',
        description: 'Decode/translate text using a trained Transformer checkpoint',
        inputSchema: {
          type: 'object',
          properties: {
            input_text: { type: 'string', description: 'Text to decode/translate' },
            checkpoint: { type: 'string', description: 'Path to model checkpoint' },
          },
          required: ['input_text', 'checkpoint'],
        },
        returnType: 'DecodedOutput with translated text and attention weights',
      },
      {
        name: 'visualize_attention',
        description: 'Visualize multi-head attention patterns for input text',
        inputSchema: {
          type: 'object',
          properties: {
            input_text: { type: 'string', description: 'Input text to visualize attention for' },
            layer: { type: 'number', description: 'Which transformer layer (0-indexed)' },
          },
          required: ['input_text'],
        },
        returnType: 'AttentionMap with per-head attention matrices as arrays',
      },
    ],
  },

  devlin2019: {
    owner: 'google-research',
    name: 'bert',
    url: 'https://github.com/google-research/bert',
    stars: 38000,
    description: 'TensorFlow code and pre-trained models for BERT',
    language: 'Python',
    topics: ['bert', 'nlp', 'pre-training', 'language-model'],
    detectedFiles: {
      entryPoints: ['run_classifier.py', 'run_squad.py', 'run_pretraining.py'],
      notebooks: [],
      modelFiles: ['modeling.py', 'optimization.py'],
      configs: ['bert_config.json'],
      dependencies: ['tensorflow>=1.11.0', 'numpy'],
    },
    mcpTools: [
      {
        name: 'classify_text',
        description: 'Fine-tune and run BERT text classification on custom data',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to classify' },
            task: { type: 'string', description: 'Task name (e.g., MNLI, SST-2, CoLA)' },
            model_size: { type: 'string', enum: ['base', 'large'], description: 'BERT model size' },
          },
          required: ['text', 'task'],
        },
        returnType: 'Classification with label, confidence, and logits',
      },
      {
        name: 'extract_embeddings',
        description: 'Extract contextual word embeddings from BERT layers',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Input text' },
            layers: { type: 'array', items: { type: 'number' }, description: 'Which layers to extract (-1 for last)' },
          },
          required: ['text'],
        },
        returnType: 'Embeddings array with per-token, per-layer vectors',
      },
      {
        name: 'answer_question',
        description: 'Run BERT question answering (SQuAD-style)',
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Question to answer' },
            context: { type: 'string', description: 'Context passage containing the answer' },
          },
          required: ['question', 'context'],
        },
        returnType: 'Answer with text span, start/end positions, confidence',
      },
    ],
  },

  radford2019: {
    owner: 'openai',
    name: 'gpt-2',
    url: 'https://github.com/openai/gpt-2',
    stars: 22400,
    description: 'Code for the paper "Language Models are Unsupervised Multitask Learners"',
    language: 'Python',
    topics: ['gpt-2', 'language-model', 'text-generation', 'nlp'],
    detectedFiles: {
      entryPoints: ['src/generate_unconditional_samples.py', 'src/interactive_conditional_samples.py'],
      notebooks: [],
      modelFiles: ['src/model.py', 'src/sample.py', 'src/encoder.py'],
      configs: ['models/124M/hparams.json'],
      dependencies: ['tensorflow>=1.12', 'numpy', 'regex', 'requests'],
    },
    mcpTools: [
      {
        name: 'generate_text',
        description: 'Generate text continuation from a prompt using GPT-2',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Text prompt to continue from' },
            model_size: { type: 'string', enum: ['124M', '355M', '774M', '1558M'], description: 'Model size' },
            length: { type: 'number', description: 'Number of tokens to generate' },
            temperature: { type: 'number', description: 'Sampling temperature (0-1)' },
            top_k: { type: 'number', description: 'Top-k sampling parameter' },
          },
          required: ['prompt'],
        },
        returnType: 'GeneratedText with full text, tokens, and log probabilities',
      },
      {
        name: 'compute_perplexity',
        description: 'Compute perplexity score for input text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to evaluate' },
            model_size: { type: 'string', description: 'Model size to use' },
          },
          required: ['text'],
        },
        returnType: 'PerplexityResult with score and per-token log probs',
      },
      {
        name: 'encode_tokens',
        description: 'Tokenize text using GPT-2 BPE tokenizer',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to tokenize' },
          },
          required: ['text'],
        },
        returnType: 'TokenList with token IDs and decoded token strings',
      },
    ],
  },

  touvron2023: {
    owner: 'facebookresearch',
    name: 'llama',
    url: 'https://github.com/facebookresearch/llama',
    stars: 56000,
    description: 'Inference code for LLaMA models',
    language: 'Python',
    topics: ['llama', 'language-model', 'meta-ai', 'inference'],
    detectedFiles: {
      entryPoints: ['example_chat_completion.py', 'example_text_completion.py'],
      notebooks: [],
      modelFiles: ['llama/model.py', 'llama/generation.py', 'llama/tokenizer.py'],
      configs: ['params.json'],
      dependencies: ['torch>=2.0', 'fairscale', 'sentencepiece', 'fire'],
    },
    mcpTools: [
      {
        name: 'chat_completion',
        description: 'Run LLaMA chat completion with system/user/assistant messages',
        inputSchema: {
          type: 'object',
          properties: {
            messages: { type: 'array', items: { type: 'object' }, description: 'Chat messages [{role, content}]' },
            max_gen_len: { type: 'number', description: 'Max generation length' },
            temperature: { type: 'number', description: 'Sampling temperature' },
          },
          required: ['messages'],
        },
        returnType: 'ChatResponse with generated message and token usage',
      },
      {
        name: 'text_completion',
        description: 'Run LLaMA text completion from a prompt',
        inputSchema: {
          type: 'object',
          properties: {
            prompts: { type: 'array', items: { type: 'string' }, description: 'List of prompts' },
            max_gen_len: { type: 'number', description: 'Max tokens to generate' },
          },
          required: ['prompts'],
        },
        returnType: 'CompletionResult with generated text per prompt',
      },
      {
        name: 'get_model_info',
        description: 'Get LLaMA model architecture details and parameter counts',
        inputSchema: {
          type: 'object',
          properties: {
            model_size: { type: 'string', enum: ['7B', '13B', '33B', '65B'], description: 'Model variant' },
          },
          required: ['model_size'],
        },
        returnType: 'ModelInfo with layers, heads, dim, vocab_size, param_count',
      },
    ],
  },

  rombach2022: {
    owner: 'CompVis',
    name: 'stable-diffusion',
    url: 'https://github.com/CompVis/stable-diffusion',
    stars: 68000,
    description: 'A latent text-to-image diffusion model',
    language: 'Python',
    topics: ['stable-diffusion', 'image-generation', 'diffusion-models', 'text-to-image'],
    detectedFiles: {
      entryPoints: ['scripts/txt2img.py', 'scripts/img2img.py'],
      notebooks: [],
      modelFiles: ['ldm/models/diffusion/ddpm.py', 'ldm/modules/diffusionmodules/openaimodel.py'],
      configs: ['configs/stable-diffusion/v1-inference.yaml'],
      dependencies: ['torch>=1.12', 'numpy', 'transformers', 'diffusers', 'Pillow'],
    },
    mcpTools: [
      {
        name: 'text_to_image',
        description: 'Generate an image from a text prompt using Stable Diffusion',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Text description of desired image' },
            negative_prompt: { type: 'string', description: 'What to avoid in the image' },
            steps: { type: 'number', description: 'Number of diffusion steps (default 50)' },
            guidance_scale: { type: 'number', description: 'Classifier-free guidance scale (default 7.5)' },
            width: { type: 'number', description: 'Image width in pixels' },
            height: { type: 'number', description: 'Image height in pixels' },
          },
          required: ['prompt'],
        },
        returnType: 'GeneratedImage with base64 image data, seed, and metadata',
      },
      {
        name: 'image_to_image',
        description: 'Transform an existing image guided by a text prompt',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded input image' },
            prompt: { type: 'string', description: 'Text guidance for transformation' },
            strength: { type: 'number', description: 'How much to transform (0-1)' },
          },
          required: ['image', 'prompt'],
        },
        returnType: 'TransformedImage with base64 output and parameters used',
      },
      {
        name: 'inpaint',
        description: 'Inpaint masked regions of an image guided by text',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded input image' },
            mask: { type: 'string', description: 'Base64-encoded mask (white = inpaint region)' },
            prompt: { type: 'string', description: 'Text description for inpainted region' },
          },
          required: ['image', 'mask', 'prompt'],
        },
        returnType: 'InpaintedImage with base64 output',
      },
    ],
  },

  he2016: {
    owner: 'KaimingHe',
    name: 'deep-residual-networks',
    url: 'https://github.com/KaimingHe/deep-residual-networks',
    stars: 4600,
    description: 'Deep Residual Learning for Image Recognition (ResNet)',
    language: 'Caffe',
    topics: ['resnet', 'image-classification', 'deep-learning', 'computer-vision'],
    detectedFiles: {
      entryPoints: ['prototxt/ResNet-50-deploy.prototxt'],
      notebooks: [],
      modelFiles: ['prototxt/ResNet-50-deploy.prototxt', 'prototxt/ResNet-101-deploy.prototxt'],
      configs: ['prototxt/ResNet-50-train-val.prototxt'],
      dependencies: ['caffe', 'numpy', 'protobuf'],
    },
    mcpTools: [
      {
        name: 'classify_image',
        description: 'Classify an image using a pre-trained ResNet model',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image or URL' },
            model_depth: { type: 'number', enum: [50, 101, 152], description: 'ResNet depth' },
            top_k: { type: 'number', description: 'Number of top predictions to return' },
          },
          required: ['image'],
        },
        returnType: 'Predictions with top-k class labels and confidence scores',
      },
      {
        name: 'extract_features',
        description: 'Extract deep feature vectors from ResNet layers',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
            layer: { type: 'string', description: 'Layer name to extract from (e.g., pool5)' },
          },
          required: ['image'],
        },
        returnType: 'FeatureVector with 2048-dim float array',
      },
      {
        name: 'batch_classify',
        description: 'Classify a batch of images efficiently',
        inputSchema: {
          type: 'object',
          properties: {
            images: { type: 'array', items: { type: 'string' }, description: 'List of base64-encoded images' },
            model_depth: { type: 'number', description: 'ResNet depth to use' },
          },
          required: ['images'],
        },
        returnType: 'BatchPredictions with per-image classification results',
      },
    ],
  },

  goodfellow2014: {
    owner: 'goodfeli',
    name: 'adversarial',
    url: 'https://github.com/goodfeli/adversarial',
    stars: 4100,
    description: 'Code and samples for "Generative Adversarial Networks"',
    language: 'Python',
    topics: ['gan', 'generative-models', 'deep-learning'],
    detectedFiles: {
      entryPoints: ['adversarial.py'],
      notebooks: [],
      modelFiles: ['adversarial.py'],
      configs: ['mnist.yaml'],
      dependencies: ['theano', 'pylearn2', 'numpy'],
    },
    mcpTools: [
      {
        name: 'generate_samples',
        description: 'Generate samples from a trained GAN generator',
        inputSchema: {
          type: 'object',
          properties: {
            num_samples: { type: 'number', description: 'Number of images to generate' },
            latent_dim: { type: 'number', description: 'Dimension of noise vector (default 100)' },
          },
          required: ['num_samples'],
        },
        returnType: 'GeneratedSamples with array of base64-encoded images',
      },
      {
        name: 'interpolate_latent',
        description: 'Interpolate between two points in latent space',
        inputSchema: {
          type: 'object',
          properties: {
            z_start: { type: 'array', description: 'Starting latent vector' },
            z_end: { type: 'array', description: 'Ending latent vector' },
            steps: { type: 'number', description: 'Number of interpolation steps' },
          },
          required: ['z_start', 'z_end', 'steps'],
        },
        returnType: 'InterpolationFrames with list of images along the path',
      },
      {
        name: 'evaluate_discriminator',
        description: 'Score how "real" the discriminator thinks an image is',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
          },
          required: ['image'],
        },
        returnType: 'DiscriminatorScore with probability (0=fake, 1=real)',
      },
    ],
  },

  kipf2017: {
    owner: 'tkipf',
    name: 'gcn',
    url: 'https://github.com/tkipf/gcn',
    stars: 7200,
    description: 'Implementation of Graph Convolutional Networks in TensorFlow',
    language: 'Python',
    topics: ['gcn', 'graph-neural-networks', 'semi-supervised-learning'],
    detectedFiles: {
      entryPoints: ['train.py'],
      notebooks: [],
      modelFiles: ['gcn/models.py', 'gcn/layers.py'],
      configs: [],
      dependencies: ['tensorflow>=1.0', 'numpy', 'scipy', 'networkx'],
    },
    mcpTools: [
      {
        name: 'classify_nodes',
        description: 'Run semi-supervised node classification on a graph',
        inputSchema: {
          type: 'object',
          properties: {
            adjacency: { type: 'string', description: 'Path to adjacency matrix (sparse format)' },
            features: { type: 'string', description: 'Path to node feature matrix' },
            labels: { type: 'string', description: 'Path to label file' },
            epochs: { type: 'number', description: 'Training epochs (default 200)' },
          },
          required: ['adjacency', 'features', 'labels'],
        },
        returnType: 'NodePredictions with per-node class labels and accuracy',
      },
      {
        name: 'get_node_embeddings',
        description: 'Extract learned node embeddings from GCN hidden layers',
        inputSchema: {
          type: 'object',
          properties: {
            adjacency: { type: 'string', description: 'Graph adjacency matrix' },
            features: { type: 'string', description: 'Node feature matrix' },
            layer: { type: 'number', description: 'Which GCN layer (0 or 1)' },
          },
          required: ['adjacency', 'features'],
        },
        returnType: 'NodeEmbeddings with n_nodes x hidden_dim matrix',
      },
    ],
  },

  mnih2015: {
    owner: 'deepmind',
    name: 'dqn',
    url: 'https://github.com/deepmind/dqn',
    stars: 5900,
    description: 'Lua/Torch implementation of Deep Q-Network (DQN) for Atari games',
    language: 'Lua',
    topics: ['deep-reinforcement-learning', 'atari', 'dqn'],
    detectedFiles: {
      entryPoints: ['run_gpu', 'run_cpu'],
      notebooks: [],
      modelFiles: ['dqn/NeuralQLearner.lua', 'dqn/convnet.lua'],
      configs: ['run_gpu'],
      dependencies: ['torch7', 'nngraph', 'image', 'alewrap'],
    },
    mcpTools: [
      {
        name: 'play_atari',
        description: 'Run DQN agent on an Atari game environment',
        inputSchema: {
          type: 'object',
          properties: {
            game: { type: 'string', description: 'Atari game ROM name (e.g., breakout, pong, space_invaders)' },
            episodes: { type: 'number', description: 'Number of episodes to play' },
            render: { type: 'boolean', description: 'Whether to record video frames' },
          },
          required: ['game'],
        },
        returnType: 'GameResult with total reward, episode lengths, and optional video',
      },
      {
        name: 'get_q_values',
        description: 'Get Q-values for all actions given a game state',
        inputSchema: {
          type: 'object',
          properties: {
            game_state: { type: 'string', description: 'Base64-encoded 84x84 grayscale frame' },
          },
          required: ['game_state'],
        },
        returnType: 'QValues with per-action Q-value estimates',
      },
      {
        name: 'train_agent',
        description: 'Train a DQN agent on a specified Atari game',
        inputSchema: {
          type: 'object',
          properties: {
            game: { type: 'string', description: 'Atari game ROM name' },
            steps: { type: 'number', description: 'Number of training steps' },
            learning_rate: { type: 'number', description: 'Learning rate (default 0.00025)' },
          },
          required: ['game'],
        },
        returnType: 'TrainingLog with reward curve and final performance',
      },
    ],
  },

  radford2021: {
    owner: 'openai',
    name: 'CLIP',
    url: 'https://github.com/openai/CLIP',
    stars: 24500,
    description: 'Contrastive Language-Image Pre-Training',
    language: 'Python',
    topics: ['clip', 'vision-language', 'zero-shot', 'multimodal'],
    detectedFiles: {
      entryPoints: ['clip/clip.py'],
      notebooks: ['notebooks/Interacting_with_CLIP.ipynb', 'notebooks/Prompt_Engineering_for_ImageNet.ipynb'],
      modelFiles: ['clip/model.py'],
      configs: [],
      dependencies: ['torch>=1.7.1', 'torchvision', 'ftfy', 'regex', 'tqdm'],
    },
    mcpTools: [
      {
        name: 'encode_image',
        description: 'Encode an image into CLIP embedding space',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
            model: { type: 'string', enum: ['ViT-B/32', 'ViT-B/16', 'ViT-L/14'], description: 'CLIP model variant' },
          },
          required: ['image'],
        },
        returnType: 'ImageEmbedding with 512-dim (or 768-dim) float vector',
      },
      {
        name: 'zero_shot_classify',
        description: 'Zero-shot image classification using text labels',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Candidate text labels' },
          },
          required: ['image', 'labels'],
        },
        returnType: 'Classification with per-label probabilities',
      },
      {
        name: 'compute_similarity',
        description: 'Compute cosine similarity between text and image embeddings',
        inputSchema: {
          type: 'object',
          properties: {
            images: { type: 'array', items: { type: 'string' }, description: 'List of base64-encoded images' },
            texts: { type: 'array', items: { type: 'string' }, description: 'List of text descriptions' },
          },
          required: ['images', 'texts'],
        },
        returnType: 'SimilarityMatrix with images x texts cosine similarity scores',
      },
    ],
  },

  ho2020: {
    owner: 'hojonathanho',
    name: 'diffusion',
    url: 'https://github.com/hojonathanho/diffusion',
    stars: 3400,
    description: 'Denoising Diffusion Probabilistic Models (DDPM)',
    language: 'Python',
    topics: ['diffusion-models', 'generative-models', 'image-generation'],
    detectedFiles: {
      entryPoints: ['scripts/run_train.py', 'scripts/run_sample.py'],
      notebooks: [],
      modelFiles: ['diffusion_tf/models/unet.py', 'diffusion_tf/diffusion_utils.py'],
      configs: [],
      dependencies: ['tensorflow>=2.0', 'numpy', 'Pillow'],
    },
    mcpTools: [
      {
        name: 'sample_images',
        description: 'Generate images by running the reverse diffusion process',
        inputSchema: {
          type: 'object',
          properties: {
            num_samples: { type: 'number', description: 'Number of images to generate' },
            timesteps: { type: 'number', description: 'Number of diffusion timesteps (default 1000)' },
          },
          required: ['num_samples'],
        },
        returnType: 'SampledImages with base64-encoded generated images',
      },
      {
        name: 'add_noise',
        description: 'Add noise to an image at a specific diffusion timestep',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
            timestep: { type: 'number', description: 'Noise level timestep (0-999)' },
          },
          required: ['image', 'timestep'],
        },
        returnType: 'NoisyImage with base64 output and noise schedule values',
      },
    ],
  },

  schulman2017: {
    owner: 'openai',
    name: 'baselines',
    url: 'https://github.com/openai/baselines',
    stars: 15800,
    description: 'High-quality implementations of reinforcement learning algorithms (PPO, A2C, DQN, etc.)',
    language: 'Python',
    topics: ['reinforcement-learning', 'ppo', 'openai', 'rl-algorithms'],
    detectedFiles: {
      entryPoints: ['baselines/run.py'],
      notebooks: [],
      modelFiles: ['baselines/ppo2/ppo2.py', 'baselines/ppo2/model.py', 'baselines/common/policies.py'],
      configs: [],
      dependencies: ['tensorflow>=1.14', 'numpy', 'gym', 'mpi4py'],
    },
    mcpTools: [
      {
        name: 'train_ppo',
        description: 'Train a PPO agent on a Gym environment',
        inputSchema: {
          type: 'object',
          properties: {
            env: { type: 'string', description: 'Gym environment ID (e.g., HalfCheetah-v3, CartPole-v1)' },
            total_timesteps: { type: 'number', description: 'Total training timesteps' },
            learning_rate: { type: 'number', description: 'Learning rate (default 3e-4)' },
            clip_range: { type: 'number', description: 'PPO clip range (default 0.2)' },
          },
          required: ['env'],
        },
        returnType: 'TrainingResult with reward curve and final policy checkpoint',
      },
      {
        name: 'evaluate_policy',
        description: 'Evaluate a trained RL policy on an environment',
        inputSchema: {
          type: 'object',
          properties: {
            env: { type: 'string', description: 'Gym environment ID' },
            checkpoint: { type: 'string', description: 'Path to saved policy' },
            episodes: { type: 'number', description: 'Number of evaluation episodes' },
          },
          required: ['env', 'checkpoint'],
        },
        returnType: 'EvalResult with mean reward, std, and per-episode rewards',
      },
    ],
  },

  dosovitskiy2021: {
    owner: 'google-research',
    name: 'vision_transformer',
    url: 'https://github.com/google-research/vision_transformer',
    stars: 10200,
    description: 'Vision Transformer (ViT) - An Image is Worth 16x16 Words',
    language: 'Python',
    topics: ['vision-transformer', 'vit', 'image-classification', 'jax'],
    detectedFiles: {
      entryPoints: ['vit_jax/main.py'],
      notebooks: ['vit_jax/ViT.ipynb'],
      modelFiles: ['vit_jax/models.py', 'vit_jax/checkpoint.py'],
      configs: ['vit_jax/configs/vit.py'],
      dependencies: ['jax', 'flax', 'tensorflow', 'numpy', 'ml_collections'],
    },
    mcpTools: [
      {
        name: 'classify_image',
        description: 'Classify an image using Vision Transformer',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
            model: { type: 'string', enum: ['ViT-B/16', 'ViT-B/32', 'ViT-L/16', 'ViT-H/14'], description: 'ViT model variant' },
          },
          required: ['image'],
        },
        returnType: 'Prediction with top-k class labels and attention maps',
      },
      {
        name: 'visualize_patches',
        description: 'Visualize how ViT splits an image into patches and their attention',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Base64-encoded image' },
            patch_size: { type: 'number', description: 'Patch size (default 16)' },
          },
          required: ['image'],
        },
        returnType: 'PatchVisualization with patch grid and attention heatmap',
      },
    ],
  },

  silver2016: {
    owner: 'Rochester-NRT',
    name: 'AlphaGo',
    url: 'https://github.com/Rochester-NRT/AlphaGo',
    stars: 3200,
    description: 'Community implementation of DeepMind AlphaGo in Python',
    language: 'Python',
    topics: ['alphago', 'go', 'mcts', 'deep-learning'],
    detectedFiles: {
      entryPoints: ['AlphaGo/training/supervised_policy_trainer.py'],
      notebooks: [],
      modelFiles: ['AlphaGo/models/policy.py', 'AlphaGo/models/value.py'],
      configs: [],
      dependencies: ['keras', 'tensorflow', 'numpy', 'h5py', 'sgfmill'],
    },
    mcpTools: [
      {
        name: 'suggest_move',
        description: 'Suggest the best move for a given Go board position',
        inputSchema: {
          type: 'object',
          properties: {
            board_state: { type: 'string', description: 'SGF format or 19x19 array of board state' },
            player: { type: 'string', enum: ['black', 'white'], description: 'Which player to move' },
          },
          required: ['board_state', 'player'],
        },
        returnType: 'MoveRecommendation with coordinates, win probability, and top-5 moves',
      },
      {
        name: 'evaluate_position',
        description: 'Evaluate the win probability of the current board position',
        inputSchema: {
          type: 'object',
          properties: {
            board_state: { type: 'string', description: 'Current Go board state' },
          },
          required: ['board_state'],
        },
        returnType: 'PositionEval with black win probability and territory estimate',
      },
    ],
  },

  kingma2014: {
    owner: 'dpkingma',
    name: 'vae',
    url: 'https://github.com/dpkingma/vae_ssl',
    stars: 600,
    description: 'Variational Auto-Encoder (M1+M2 models)',
    language: 'Python',
    topics: ['vae', 'variational-inference', 'generative-models'],
    detectedFiles: {
      entryPoints: ['run_2layer.py', 'run_gpulearn_z_x.py'],
      notebooks: [],
      modelFiles: ['models/gpulearn_z_x.py'],
      configs: [],
      dependencies: ['theano', 'numpy', 'anglepy'],
    },
    mcpTools: [
      {
        name: 'encode',
        description: 'Encode input data into latent space (mean and variance)',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'Base64-encoded input (image or features)' },
          },
          required: ['data'],
        },
        returnType: 'LatentCode with mean, log_variance, and sampled z vectors',
      },
      {
        name: 'decode',
        description: 'Decode a latent vector back to data space',
        inputSchema: {
          type: 'object',
          properties: {
            z: { type: 'array', items: { type: 'number' }, description: 'Latent vector to decode' },
          },
          required: ['z'],
        },
        returnType: 'ReconstructedData with base64-encoded output',
      },
      {
        name: 'reconstruct',
        description: 'Encode then decode an input (full reconstruction pipeline)',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'Base64-encoded input' },
          },
          required: ['data'],
        },
        returnType: 'Reconstruction with original, latent, and reconstructed outputs',
      },
    ],
  },
};

// Lookup a repo for a paper ID
export function getRepoForPaper(paperId) {
  return REPO_DATA[paperId] || null;
}

// Get full MCP server config JSON for a paper
export function getMCPConfig(paperId) {
  const repo = REPO_DATA[paperId];
  if (!repo) return null;

  return {
    mcpServers: {
      [`paper2agent-${repo.name}`]: {
        command: 'npx',
        args: ['-y', `@paper2agent/${repo.name}-server`],
        env: {
          REPO_URL: repo.url,
          MODEL_CACHE: '~/.cache/paper2agent',
        },
      },
    },
  };
}

// Get all paper IDs that have repos
export function getPaperIdsWithRepos() {
  return Object.keys(REPO_DATA);
}

export { REPO_DATA };
