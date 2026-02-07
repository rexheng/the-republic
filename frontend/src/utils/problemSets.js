// Bundled mathematical conjectures as paper-like objects for the AI Research Lab.
// Each includes the conjecture statement, known results, open questions,
// and iterative AI strategies for exploration.

export const PROBLEM_SETS = [
  {
    id: 'problem-erdos-gyarfas',
    title: 'Erdős–Gyárfás Conjecture: Power-of-2 Cycles in Graphs',
    authors: ['Paul Erdős', 'András Gyárfás'],
    year: 1995,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Graph Theory', 'Combinatorics', 'Extremal Graph Theory'],
    abstract: `Conjecture: Every graph with minimum degree at least 3 contains a simple cycle whose length is a power of 2.

KNOWN RESULTS: The conjecture is proven for several restricted graph classes including diameter-2 graphs, P₁₀-free graphs, and various classes with extra structural constraints. Computational verification has shown that any counterexample must have at least 17 vertices in general, and at least 30 vertices for cubic graphs. The typical proof strategy involves structural decomposition and identifying "recurrent gadgets" that enforce cycles of length 4 or 8.

OPEN QUESTIONS: The full conjecture remains open for general graphs. Key gaps include: (1) extending diameter-2 results to higher diameters, (2) pushing the minimum counterexample size beyond current bounds, (3) identifying forbidden substructures whose absence forces power-of-2 cycles.

AI STRATEGY — ITERATIVE APPROACH: An AI system could attack this problem through aggressive counterexample search by encoding "minimal counterexample" conditions (cubic, high connectivity, girth constraints, no power-of-2 cycles) as SAT/MILP instances and pushing known lower bounds. Graph-neural models trained on extremal graphs could guess structural invariants whose violation forces a power-of-2 cycle. The likely proof pattern would be: show any minimal counterexample must lie in a very narrow structural class (by iterating learned lemmas), fully classify that class computationally, and find an explicit power-of-2 cycle or contradiction. Self-critique via parallel counterexample search would continuously validate or refute conjectured lemmas.`,
  },
  {
    id: 'problem-erdos-szekeres',
    title: 'Quantitative Erdős–Szekeres Conjecture (Happy Ending Problem)',
    authors: ['Paul Erdős', 'George Szekeres'],
    year: 1935,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Combinatorial Geometry', 'Ramsey Theory', 'Discrete Mathematics'],
    abstract: `Conjecture: The minimum number f(n) of points in general position in the plane that guarantees n points in convex position satisfies f(n) = 2^(n-2) + 1.

KNOWN RESULTS: Values of f(n) are known exactly for n ≤ 6. The cups-caps theorem provides the classical upper bound. Andrew Suk's breakthrough (2017) brought the upper bound very close to the conjectured value for large n, achieving f(n) ≤ 2^(n+o(n)). The lower bound f(n) ≥ 2^(n-2) + 1 is established by explicit constructions.

OPEN QUESTIONS: Closing the gap between Suk's near-optimal upper bound and the conjectured exact value. Determining f(7) exactly. Understanding the structure of extremal point configurations that avoid large convex subsets.

AI STRATEGY — ITERATIVE APPROACH: An AI could formalize the cups-caps theorem and its refinements plus modern advances into a proof assistant, building a library of geometric Ramsey-type lemmas (Dilworth-like decompositions, chains/antichains, hypergraph containers). Massive configuration mining would generate random and extremal point sets, searching for those saturating current bounds, and record their combinatorial "signatures" (order type, layer structure, hull size sequence). Automated inequality discovery would treat bounds on f(n) as symbolic regression problems, using extremal configuration data to guess tighter bounds. The realistic early win is sharpening constants and error terms in the best known bounds and rigorously pinning down more small n cases.`,
  },
  {
    id: 'problem-erdos-straus',
    title: 'Erdős–Straus Conjecture: Egyptian Fraction Decomposition of 4/n',
    authors: ['Paul Erdős', 'Ernst G. Straus'],
    year: 1948,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Number Theory', 'Diophantine Equations', 'Computational Mathematics'],
    abstract: `Conjecture: For every integer n ≥ 2, there exist positive integers a, b, c such that 4/n = 1/a + 1/b + 1/c.

KNOWN RESULTS: The conjecture is computationally verified for all n up to 10^17. Multiple parametric families (ED1, ED2 approaches) cover large sets of n values through affine lattice structures. Recent constructive algorithmic frameworks provide systematic coverage via residue class analysis. The conjecture reduces to proving it for prime n, since composite cases follow from prime decompositions.

OPEN QUESTIONS: No single unified construction covers all primes. The set of "hard" primes (those not easily covered by known parametric families) remains infinite, though increasingly sparse. Whether a finite set of parametric families suffices to cover all residue classes modulo some M is unknown.

AI STRATEGY — ITERATIVE APPROACH: An AI has a very clear iterative loop here. First, encode existing parametric families and their affine lattice structure, extracting the general pattern of parameterizations. Then systematically treat each residue class modulo a large modulus M as a separate subproblem, discovering simple parametric families of triples (a,b,c) via symbolic template search (e.g. a = αn + β) combined with Diophantine constraints. Use "convolution" and "anti-convolution" ideas between parameterizations to uncover canonical forms that subsume known ones. The path to proof: show every residue class modulo some M is covered by at least one parametric family except for finitely many n, combine with finite computational check, and conclude.`,
  },
  {
    id: 'problem-ramsey-r55',
    title: 'Ramsey Number R(5,5): Closing the Gap',
    authors: ['Frank P. Ramsey', 'Paul Erdős'],
    year: 1930,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Ramsey Theory', 'Combinatorics', 'Computational Complexity'],
    abstract: `Problem: Determine the exact value of R(5,5), the smallest N such that any red/blue 2-coloring of the edges of the complete graph K_N contains a monochromatic K_5. Currently 43 ≤ R(5,5) ≤ 46.

KNOWN RESULTS: The upper bound R(5,5) ≤ 46 was obtained by a combination of linear programming bounds and heavy computer search (Angeltveit & McKay, 2024). The lower bound R(5,5) ≥ 43 comes from explicit constructions of (5,5)-Ramsey colorings on K_42. The "flag algebra" method and semidefinite programming provide framework for bounding.

OPEN QUESTIONS: Closing the gap from [43, 46] to an exact value. Whether R(5,5) = 43 (the conjectured value by many experts). Producing formally verified computer-assisted proofs. The structure of near-extremal Ramsey colorings.

AI STRATEGY — ITERATIVE APPROACH: An AI could rebuild the extremal landscape by reconstructing known colorings of K_42 and K_43, encoding them as SAT/SMT/MILP constraints with symmetry reductions. Deep search with learned heuristics would train models on partial colorings and their extension success probabilities to guide search, using reinforcement learning for branching orders and symmetry-breaking constraints. For the upper bound: attempt purely computational elimination of all colorings at N = 45 or 44, supported by formally verified code and DRAT certificates. For the lower bound: search for explicit colorings on K_43 combining constructive templates with local search. The ultimate AI proof would likely be an enormous case analysis compressed into solver-verified certificates.`,
  },
  {
    id: 'problem-erdos-hajnal',
    title: 'Erdős–Hajnal Conjecture: Homogeneous Sets in H-free Graphs',
    authors: ['Paul Erdős', 'András Hajnal'],
    year: 1989,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Graph Theory', 'Ramsey Theory', 'Combinatorics'],
    abstract: `Conjecture: For every graph H, there exists ε(H) > 0 such that every graph G on n vertices that does not contain H as an induced subgraph has either a clique or independent set of size at least n^ε(H).

KNOWN RESULTS: The conjecture is proven for graphs H on at most 4 vertices, paths of length 4, and a few other special cases. The best general result gives a bound of exp(c·√(log n)) for the homogeneous set size (far below the conjectured polynomial). The "substitution" method shows the conjecture is closed under substitution. For tournaments, Alon, Pach, and Solymosi proved the analogous result for tournaments with at most 5 vertices.

OPEN QUESTIONS: The conjecture remains open for the 5-vertex path P₅ and bull graph. Whether a unified structural approach can handle all forbidden subgraphs simultaneously. The relationship between the optimal exponent ε(H) and structural properties of H. Connections to the strong perfect graph theorem and χ-boundedness.

AI STRATEGY — ITERATIVE APPROACH: An AI could systematically formalize existing proofs for small H cases, extracting common structural lemmas (Ramsey multiplicity, regularity lemma applications). For specific open cases like P₅-free graphs, it could: search for extremal graph families approaching the conjectured bound, mine structural patterns via GNN embeddings, propose new decomposition theorems, and test them in a proof assistant. Automated counterexample search would try to construct H-free graphs with small homogeneous sets, mapping the frontier of what's achievable.`,
  },
  {
    id: 'problem-frankl-union-closed',
    title: "Frankl's Conjecture (Union-Closed Sets Conjecture)",
    authors: ['Péter Frankl'],
    year: 1979,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Combinatorics', 'Set Theory', 'Lattice Theory'],
    abstract: `Conjecture: For every finite union-closed family of finite sets (not consisting only of the empty set), there exists an element that belongs to at least half the sets in the family.

KNOWN RESULTS: Justin Gilmer (2022) proved the first constant-fraction bound: there exists an element in at least 1% of the sets. Subsequent improvements by Alweiss, Huang, Sellke, Chase, and Lovett pushed this toward 38.23%. The conjecture is verified for families with at most 50 elements in the ground set. It holds for "separating" families and families whose lattice has certain structural properties.

OPEN QUESTIONS: Closing the gap between the best known constant fraction (~38.23%) and the conjectured 50%. Whether information-theoretic / entropy methods can reach 50%. The lattice-theoretic formulation: every finite lattice has a join-irreducible element in at least half the lattice's elements' upper sets.

AI STRATEGY — ITERATIVE APPROACH: An AI could leverage the recent entropy-based breakthroughs, formalizing the information-theoretic framework and systematically searching for tighter entropy inequalities. It could enumerate extremal union-closed families that minimize the maximum element frequency, looking for structural patterns. The lattice-theoretic dual formulation opens connections to order theory that an AI could exploit by mining lattice databases. Automated inequality discovery via symbolic regression on extremal family data could identify the path from 38.23% to 50%.`,
  },
  {
    id: 'problem-erdos-turan-additive',
    title: 'Erdős–Turán Conjecture on Additive Bases',
    authors: ['Paul Erdős', 'Pál Turán'],
    year: 1941,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Additive Combinatorics', 'Number Theory', 'Analytic Number Theory'],
    abstract: `Conjecture: If A is an additive basis of order 2 (i.e., the representation function r(n) = |{(a,b) ∈ A² : a+b = n}| is positive for all sufficiently large n), then r(n) cannot be bounded — that is, lim sup r(n) = ∞.

KNOWN RESULTS: Erdős and Fuchs (1956) proved that r(n) cannot be "too constant" — specifically, the sum Σ_{k≤n} r(k) cannot be well-approximated by cn for any constant c. For Sidon sets (where r(n) ≤ 2), the maximum density is known to be ~√n. Extensive computational experiments have not found any counterexample basis with bounded representation function. The analogous conjecture for higher-order bases remains open.

OPEN QUESTIONS: Whether there exists a basis of order 2 with r(n) = O(1). The optimal growth rate of r(n) for "thin" bases. Connections to the probabilistic method — random bases give r(n) ~ log n, but can structured bases do better? The relationship to Sidon set constructions and sum-free set theory.

AI STRATEGY — ITERATIVE APPROACH: An AI could systematically search for additive bases with slowly growing representation functions, encoding the problem as constraint satisfaction over integer sets. It could mine the space of algebraic constructions (modular arithmetic bases, polynomial bases) testing their representation functions computationally. Automated theorem proving could formalize the Erdős-Fuchs machinery and attempt to strengthen it toward the full conjecture. Pattern discovery in computed representation functions of known thin bases could suggest new structural constraints that force unboundedness.`,
  },
  {
    id: 'problem-erdos-ulam',
    title: 'Erdős–Ulam Problem: Dense Sets with Rational Distances',
    authors: ['Paul Erdős', 'Stanisław Ulam'],
    year: 1945,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Combinatorial Geometry', 'Number Theory', 'Algebraic Geometry'],
    abstract: `Problem: Does there exist a dense subset of the plane such that all pairwise distances between points in the set are rational?

KNOWN RESULTS: No such dense set is known to exist, and the conjecture is that none does. It is known that any set with all rational distances must be very sparse — specifically, it cannot contain a dense subset of any open region. Connections to elliptic curves show that points on certain curves can give infinite rational-distance sets, but these are nowhere dense. The Erdős–Ulam problem is equivalent to asking whether a certain algebraic variety has a dense set of rational points.

OPEN QUESTIONS: The full problem remains wide open. Whether the algebraic geometry formulation (rational points on a specific variety) can be resolved using modern tools from arithmetic geometry. Whether computational search can find large finite rational-distance sets with surprising structure. The relationship to the Bombieri-Lang conjecture in algebraic geometry.

AI STRATEGY — ITERATIVE APPROACH: An AI could search for increasingly large finite rational-distance sets, looking for structural patterns (do they tend to lie on curves? what algebraic structures emerge?). It could formalize the connection to algebraic geometry and attempt to apply modern tools from arithmetic geometry (heights, rational points on varieties) via proof assistants. Mining existing databases of elliptic curves and rational points could reveal structural constraints. The most promising path may be to prove impossibility by showing any such set must satisfy contradictory algebraic conditions.`,
  },
  {
    id: 'problem-navier-stokes',
    title: 'Navier–Stokes Existence and Smoothness (Millennium Problem)',
    authors: ['Claude-Louis Navier', 'George Gabriel Stokes'],
    year: 1845,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Partial Differential Equations', 'Fluid Dynamics', 'Mathematical Physics'],
    abstract: `Problem: Prove or disprove that in three dimensions, given any smooth, divergence-free initial velocity field with finite energy, there exists a smooth solution to the Navier-Stokes equations that extends for all time and satisfies certain bounds — or show that solutions can develop singularities (blow-up) in finite time.

KNOWN RESULTS: Global existence and uniqueness is established in 2D (Ladyzhenskaya, 1969). In 3D, local existence and uniqueness is known for smooth data (Leray, 1934), and global existence of weak solutions (Leray solutions) is established, but uniqueness and regularity of weak solutions remain open. Partial regularity results (Caffarelli-Kohn-Nirenberg, 1982) show that the set of singular points has zero 1-dimensional Hausdorff measure. Terence Tao (2016) showed blow-up for an averaged version of the equations.

OPEN QUESTIONS: Whether finite-time blow-up occurs for smooth initial data in 3D. The structure of potential singularities. Whether Leray-Hopf weak solutions are unique. The gap between the critical Sobolev space H^(1/2) and known regularity results. Whether self-similar blow-up solutions exist.

AI STRATEGY — ITERATIVE APPROACH: An AI could mine the vast PDE literature to formalize all known a priori estimates and regularity criteria into a unified framework. It could run high-resolution numerical simulations searching for near-singular behavior in carefully chosen initial data, identifying potential blow-up scenarios. Automated symbolic computation could search for new conserved quantities or Lyapunov functionals. The most tractable AI contribution would be: discovering new regularity criteria by pattern-matching across known results, identifying initial data configurations most likely to produce singularities via simulation, and formalizing partial results in proof assistants.`,
  },
  {
    id: 'problem-lonely-runner',
    title: 'Lonely Runner Conjecture',
    authors: ['Jörg M. Wills'],
    year: 1967,
    citationCount: 0,
    source: 'problem',
    fieldsOfStudy: ['Number Theory', 'Diophantine Approximation', 'Combinatorics'],
    abstract: `Conjecture: Consider k+1 runners on a circular track of unit length, starting at the same point at time 0 and running with pairwise distinct constant speeds. For each runner, there is a time at which that runner is at distance at least 1/(k+1) from all other runners.

KNOWN RESULTS: The conjecture is proven for k ≤ 6 runners (Barajas & Serra, 2008). For k = 7, partial results exist. The conjecture is equivalent to a statement about the view-obstruction problem and to a problem in Diophantine approximation about simultaneous approximation. It is also related to the chromatic number of distance graphs. Czerwiński and Grytczuk (2008) showed connections to flows in graphs.

OPEN QUESTIONS: The conjecture for k ≥ 7 runners. Whether there exist "lonely" times that work for all runners simultaneously. The structure of speed vectors that make the conjecture hardest to satisfy. Connections to the Fraenkel conjecture on Beatty sequences.

AI STRATEGY — ITERATIVE APPROACH: An AI could encode the problem as a continuous optimization problem and search for speed vectors that minimize the maximum loneliness, identifying hardest instances. For small k, exhaustive symbolic computation could verify the conjecture and extract structural lemmas about critical speed configurations. The Diophantine approximation formulation opens the door to lattice-based methods: an AI could search for lattice structures in the speed space that govern lonely times. Automated number-theoretic reasoning about simultaneous approximation could formalize new bounds. The connection to distance graph coloring suggests graph-theoretic approaches that an AI could systematically explore.`,
  },
];
