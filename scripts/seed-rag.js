#!/usr/bin/env node
/**
 * Seed script: Extract Unit 2 text content → Embedding → Supabase documents table
 * Run: node scripts/seed-rag.js
 * Requires: DEEPSEEK_API_KEY, GLM_VISION_4_6V_FLASH_API_KEY, ZHIPU_EMBEDDING_API_KEY configured on Vercel
 */

const VERCEL_API = 'https://biology-study-hub.vercel.app';

// Unit 2 key content chunks for RAG
const CHUNKS = [
  // 2.1 Cell Structure
  {
    section: '2.1',
    text: 'All living organisms are made up of units called cells. Cells are too small to see with the naked eye, so a light microscope is used: visible light passes through a specimen and a series of lenses magnify the image. A useful magnification of about 400 times can be achieved. Contrast is improved by using dyes or stains — methylene blue for animal cells, iodine solution for plant cells.',
    cn: '所有生物都由细胞构成。用光学显微镜放大观察，可达约400倍。染色提高对比度：动物细胞用亚甲基蓝，植物细胞用碘液。'
  },
  {
    section: '2.1',
    text: 'Cells share three features in common: a cell surface membrane surrounding the cytoplasm, cytoplasm containing water and dissolved substances, and a nucleus containing genetic material (DNA). Plant cells have three additional features: a cellulose cell wall, a large permanent vacuole, and chloroplasts.',
    cn: '所有细胞共有：细胞膜、细胞质、细胞核。植物细胞额外有：纤维素细胞壁、大液泡、叶绿体。'
  },
  {
    section: '2.1',
    text: 'The cell surface membrane controls entry and exit of dissolved substances. Cytoplasm holds organelles such as ribosomes (protein synthesis) and mitochondria (aerobic respiration). The nucleus carries coded instructions on chromosomes that control the cell\'s activities. In plant cells, chloroplasts contain chlorophyll and enzymes for photosynthesis; the large permanent vacuole provides turgor pressure; the cellulose cell wall is freely permeable and gives structural support.',
    cn: '细胞膜控制物质进出；核糖体合成蛋白质；线粒体呼吸作用；叶绿体光合作用；液泡提供膨压；细胞壁提供结构支持。'
  },
  {
    section: '2.1',
    text: 'Magnification = Measured length (image size) ÷ Actual length. Size is measured in mm or μm (1 mm = 1000 μm). A scale bar can also be used to work out magnification.',
    cn: '放大倍数 = 像长 ÷ 实长。单位mm或μm。'
  },

  // 2.2 Organisation
  {
    section: '2.2',
    text: 'Large organisms are multicellular. Different cell types have particular structures designed to help them carry out different tasks — they have become specialised. The red blood cell transports oxygen (filled with haemoglobin, no nucleus, flexible). The root hair cell has a long extension increasing surface area for absorbing water and minerals. The xylem vessel has no cytoplasm and no end wall so it forms a continuous tube, strengthened with lignin.',
    cn: '多细胞生物有特化细胞：红细胞运氧（无核、含血红蛋白）；根毛细胞吸水吸矿（突起增大表面积）；木质部导管运输（无端壁、木质素加固）。'
  },
  {
    section: '2.2',
    text: 'Cells with similar structures and functions are massed together into tissues. Animal tissues include epithelium, connective tissue/blood, muscle tissue, and nervous tissue. Plant tissues include epidermis, mesophyll (photosynthesis), and vascular tissue (transport).',
    cn: '组织 = 相似细胞群。动物：上皮、结缔/血液、肌肉、神经。植物：表皮、叶肉、维管。'
  },
  {
    section: '2.2',
    text: 'Several tissues combine to form an organ — a complex structure with a particular function (e.g. the small intestine, the heart, a leaf). Several organs work together to perform a task, forming an organ system (e.g. digestive system). The full hierarchy of organisation is: organelle → cell → tissue → organ → organ system → organism.',
    cn: '组织层级：细胞器→细胞→组织→器官→器官系统→生物体。分工协作。'
  },

  // 2.3 Diffusion
  {
    section: '2.3',
    text: 'The cell surface membrane regulates what passes in and out. A partially permeable membrane lets some particles (e.g. water, glucose) through but blocks others (e.g. protein). Diffusion is the main process by which substances move over short distances in living organisms.',
    cn: '细胞膜控制物质进出。半透性膜让小分子通过、阻止大分子。扩散是物质短距离移动的主要方式。'
  },
  {
    section: '2.3',
    text: 'Diffusion: Particles in a liquid or gas move randomly. The net movement is from a region of higher concentration to a region of lower concentration — down a concentration gradient — until equilibrium is reached. Diffusion is passive — it costs the organism no energy.',
    cn: '扩散：粒子从高浓度向低浓度净移动，直到平衡。被动过程，不耗能。'
  },
  {
    section: '2.3',
    text: 'Living organisms have adaptations to speed up diffusion: diffusion distances are short (lung membranes are very thin), large surface area (many alveoli, root hairs, villi), concentration gradients are maintained (circulating blood, breathing). The surface area to volume ratio experiment shows smaller cubes turn orange faster — larger SA:Vol ratio means faster diffusion.',
    cn: '加速扩散三要素：距离短、表面积大、梯度陡。表面积/体积比大的物体扩散更快。'
  },

  // 2.4 Osmosis & Active Transport
  {
    section: '2.4',
    text: 'Osmosis is a special case of diffusion — it is the diffusion of water molecules. Pure water has the highest water potential; adding solute lowers it. A dilute solution = high water potential; a concentrated solution = low water potential.',
    cn: '渗透 = 水的扩散。纯水水势最高；加溶质降低水势。稀溶液=高水势；浓溶液=低水势。'
  },
  {
    section: '2.4',
    text: 'Osmosis definition: the net movement of water molecules from a region of higher water potential to a region of lower water potential, down a water potential gradient, through a partially permeable membrane. It continues until water equilibrium is reached.',
    cn: '渗透定义：水分子通过半透膜，从高水势向低水势净移动，直到平衡。'
  },
  {
    section: '2.4',
    text: 'Plant cell in hypotonic solution: takes in water, becomes turgid (firm, healthy). The cell wall prevents bursting. Plant cell in hypertonic solution: loses water, becomes flaccid, then plasmolysis occurs (membrane pulls away from wall). Animal cell in hypotonic: takes in water, swells, bursts (haemolysis) — no wall. Animal cell in hypertonic: loses water, shrinks, becomes crenated.',
    cn: '植物细胞低渗→吸水→坚挺turgid（有壁不破）；高渗→失水→质壁分离plasmolysis。动物细胞低渗→胀破haemolysis（无壁）；高渗→皱缩crenated。'
  },
  {
    section: '2.4',
    text: 'Active transport: movement AGAINST a concentration gradient (low to high), using energy from respiration, via carrier proteins. Examples: root hair cells absorbing mineral ions from soil even when soil concentration is low; small intestine absorbing glucose when gut concentration is lower than blood. Carrier proteins are specific — they only transport particular molecules.',
    cn: '主动运输：逆浓度梯度（低→高），需要能量（呼吸作用）和载体蛋白。例子：根毛吸矿质离子、小肠吸葡萄糖。'
  },
  {
    section: '2.4',
    text: 'Endocytosis and exocytosis: bulk transport of large particles. Endocytosis = taking material into the cell (phagocytosis = "cell eating"). Exocytosis = releasing material from the cell. These processes require energy.',
    cn: '胞吞胞吐：大颗粒的批量运输。胞吞=进入（吞噬）；胞吐=释放。需要能量。'
  }
];

async function main() {
  console.log(`Seeding ${CHUNKS.length} chunks to Supabase via /api/rag/upload...\n`);

  try {
    const resp = await fetch(`${VERCEL_API}/api/rag/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chunks: CHUNKS,
        source: 'unit2-textbook',
        unit: 'Unit TS2'
      })
    });

    const data = await resp.json();

    if (data.success) {
      console.log(`✅ Success! Indexed ${data.chunks_indexed}/${data.total} chunks`);
      if (data.errors && data.errors.length) {
        console.log(`⚠️  Errors: ${data.errors.length}`);
        data.errors.forEach(e => console.log(`   ${e}`));
      }
    } else {
      console.error('❌ Failed:', data.error || data);
    }
  } catch (err) {
    console.error('❌ Network error:', err.message);
  }
}

main();
