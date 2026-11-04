/**
 * dsh-2d-model-picker —— 浏览器半边（browser half）
 * ============================================================================
 * 一个「二维」的模型 × 推理强度选择器：横轴（列）是推理强度档位，纵轴（行）是模型。
 * 一个可拖动的滑点吸附在二维矩阵的交叉点上，松手即确认「模型 + 推理等级」组合。
 *
 * 这是手写的经典脚本，无构建步骤：宿主按 exports["./client"] 读文件字节组合进
 * combo 后以 <script> 执行。约束：
 *   - 不能用 import/export；
 *   - 顶层必须同步调用 window.__ModuleLoader__.load({ id, factory })；
 *   - factory 里能 require 的只有平台种子：react / react-dom / @deepseek-ai/cordis /
 *     @deepseek-ai/dsh-client-store / dsh-client-ui-slots / dsh-client-ui-primitives /
 *     dsh-client-ui-dockkit。
 *
 * 数据全部来自 DSH 真实会话：读 = modelSelection 投影，列 = modelCatalog，
 * 写 = remote.session.selectModel。没有任何假数据。
 */
window.__ModuleLoader__.load({
  id: 'dsh-2d-model-picker',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement

    const PLUGIN_ID = 'dsh-2d-model-picker'
    /** 接管原生模型选择器所在的 single 槽；priority -1 遮蔽原生 ModelSelect（越低越优先）。 */
    const SLOT = 'conversation.input.model'
    const SLOT_PRIORITY = -1

    /* ---------------- 几何（CSS 与坐标计算共用同一组常量） ---------------- */
    const LABEL_W = 136 // 左侧模型名列宽（最小宽度；实际按最长模型名自适应）
    const LABEL_H = 30 // 顶部档位标题行高
    const CELL_W = 64 // 单列宽
    const CELL_H = 40 // 单行高
    const CARD_MAX_W = 640 // 卡片最大宽（超出则横向滚动）
    const CARD_MAX_H = 420 // 网格区最大高（超出则纵向滚动）
    const PUCK_R = 8 // 滑点半径

    /** 无档位模型的占位列 id（提交时映射为「不写 reasoningEffort」）。 */
    const DEFAULT_EFFORT_ID = '__default__'

    /* ---------------- DeepSeek 色系 ---------------- */
    const DS_BLUE = '#4d6bfe' // 品牌蓝
    const DS_BLUE_DEEP = '#3a4fdb' // 深一档
    const DS_VIOLET = '#8b5cf6' // max 档紫
    const MAX_GRAD_ID = 'dsh2d-max-grad'

    /* 模型强弱排序：按 id/name 关键词打分，同分按档位数量，再保持目录原顺序 */
    const STRENGTH_RULES = [
      { score: 100, re: /\b(ultra|opus|o3-?pro|max|sol|gpt-?6)\b/i },
      { score: 82, re: /\b(pro|plus|reasoner|thinking|preview)\b/i },
      { score: 55, re: /\b(terra|sonnet|chat|standard|medium|normal)\b/i },
      { score: 22, re: /\b(flash|fast|lite|light|mini|nano|small|instant|luna|air|haiku)\b/i },
    ]
    const strengthOf = (entry) => {
      const key = (((entry && entry.model && entry.model.id) || '') + ' ' + ((entry && entry.model && entry.model.name) || '')).toLowerCase()
      for (const rule of STRENGTH_RULES) if (rule.re.test(key)) return rule.score
      return 45
    }
    const cyOf = (row) => LABEL_H + (row + 0.5) * CELL_H

    /* ---------------- 档位顺序与文案（adapter 只给 id 时兜底） ---------------- */
    const EFFORT_RANK = {
      off: -10,
      none: 0, min: 0, minimal: 0, minimal_effort: 0,
      low: 1, light: 1,
      standard: 2, medium: 2, normal: 2,
      high: 3, extended: 3,
      xhigh: 4, 'x-high': 4,
      max: 5,
      ultra: 6,
    }
    const rankOf = (id) => {
      const k = String(id || '').toLowerCase()
      if (k === DEFAULT_EFFORT_ID) return -20
      return Object.prototype.hasOwnProperty.call(EFFORT_RANK, k) ? EFFORT_RANK[k] : 1000
    }
    const lower = (s) => String(s || '').toLowerCase()

    function tierLabel(effort) {
      const name = (effort && (effort.name || effort.id)) || ''
      return { short: name, desc: (effort && effort.description) || '' }
    }

    /** 无档位的模型给一个占位「默认」档，保证在矩阵里有交叉点可点。 */
    function effectiveEfforts(model) {
      const eff = model && model.reasoning && Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : []
      if (eff.length) return eff
      return [{ id: DEFAULT_EFFORT_ID, name: '默认', description: '使用该模型默认推理强度' }]
    }

    function flattenModels(catalog) {
      const out = []
      if (!catalog || !Array.isArray(catalog.groups)) return out
      for (const group of catalog.groups) {
        if (!group || !Array.isArray(group.models)) continue
        for (const model of group.models) out.push({ provider: group.id, groupName: group.name || group.id, model })
      }
      return out
    }

    function findEntry(entries, selection) {
      if (!selection) return null
      return entries.find((e) => e.provider === selection.provider && e.model.id === selection.model) || null
    }

    /* ---------------- 数据钩子：读投影 + 拉目录 ---------------- */
    function useModelSelection(ctx, sessionId) {
      const [projection, setProjection] = React.useState(null)
      React.useEffect(() => {
        if (!sessionId) return undefined
        let face = null
        try {
          const binding = ctx.sessions && ctx.sessions.binding ? ctx.sessions.binding(sessionId) : null
          face = binding && binding.session && binding.session.projections
            ? binding.session.projections.faceOf('modelSelection')
            : null
        } catch (error) { face = null }
        if (!face || typeof face.getSnapshot !== 'function') return undefined
        const sync = () => setProjection(face.getSnapshot() || null)
        sync()
        const dispose = typeof face.subscribe === 'function' ? face.subscribe(sync) : null
        return () => { if (typeof dispose === 'function') dispose() }
      }, [ctx, sessionId])
      return projection
    }

    function useModelCatalog(ctx) {
      const [catalog, setCatalog] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        const load = () => {
          Promise.resolve()
            .then(() => ctx.remote.session.modelCatalog())
            .then((result) => { if (!alive) return; if (result && result.ok) setCatalog(result.value) })
            .catch(() => {})
        }
        load()
        const disposers = []
        try { if (ctx.remote && ctx.remote.$on) disposers.push(ctx.remote.$on('llm/adapters-updated', load)) } catch (error) {}
        try { if (ctx.on) disposers.push(ctx.on('connection/reset', load)) } catch (error) {}
        return () => {
          alive = false
          for (const dispose of disposers) { try { if (typeof dispose === 'function') dispose() } catch (error) {} }
        }
      }, [ctx])
      return catalog
    }

    /* ---------------- 样式（走 DSH 主题 token，深浅色自动适配） ---------------- */
    const CSS = `
.dsh2d-root{display:inline-flex;align-items:center;font-family:var(--dsw-font-family,system-ui,sans-serif)}
.dsh2d-pop{font-family:var(--dsw-font-family,system-ui,sans-serif)}
.dsh2d-trigger{
  display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 8px;
  border-radius:8px;border:1px solid var(--dsw-alias-border-l1,transparent);
  background:transparent;color:var(--dsw-alias-label-primary,#161616);
  font-size:13px;cursor:pointer;white-space:nowrap;max-width:240px;
}
.dsh2d-trigger:hover{background:var(--dsw-alias-bg-layer-1,transparent)}
.dsh2d-trigger:disabled{opacity:.5;cursor:not-allowed}
.dsh2d-trigger .dsh2d-model{overflow:hidden;text-overflow:ellipsis}
.dsh2d-trigger .dsh2d-effort{color:var(--dsw-alias-label-secondary,#6b6b6b);font-size:12px}
.dsh2d-trigger .dsh2d-chevron{flex:0 0 auto;color:var(--dsw-alias-label-secondary,#8a8a8a)}
.dsh2d-pop{
  position:fixed;z-index:9999;display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-base,transparent);
  border:1px solid var(--dsw-alias-border-l2,transparent);
  border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.1);
  padding:12px;min-width:280px;
}
.dsh2d-scroll{position:relative;z-index:1;overflow:auto;max-width:${CARD_MAX_W}px;max-height:${CARD_MAX_H}px}
.dsh2d-pad{display:block;touch-action:none;cursor:default}
.dsh2d-pad.dsh2d-hovering{cursor:grab}
.dsh2d-pad.dsh2d-grabbing{cursor:grabbing}
.dsh2d-pad:focus{outline:1px solid #4d6bfe;outline-offset:2px;border-radius:6px}
.dsh2d-puck{transition:transform .16s cubic-bezier(.2,.8,.25,1)}
.dsh2d-puck.dsh2d-dragging{transition:none}
.dsh2d-puck .dsh2d-glow{transition:opacity .14s ease}
.dsh2d-max-halo{animation:dsh2d-max-pulse 2.2s ease-out infinite}
.dsh2d-max-halo.dsh2d-delay{animation-delay:1.1s}
@keyframes dsh2d-max-pulse{0%{r:9px;opacity:.45}70%{r:24px;opacity:0}100%{r:24px;opacity:0}}
/* max 强化版：只改推理强度文字色（带过渡）；背景与边框保持原生 */
.dsh2d-trigger .dsh2d-effort{transition:color .35s ease}
.dsh2d-trigger.dsh2d-max .dsh2d-effort{color:#a855f7}
/* max 氛围：面板内淡淡的漂浮粒子（从左向右，均匀分布） */
@property --dsh2d-speed{syntax:'<number>';inherits:true;initial-value:1}
.dsh2d-particles{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;z-index:0;animation:dsh2d-particles-in .55s ease-out both}
.dsh2d-particles.dsh2d-fading{animation:none;opacity:0;transition:opacity .38s ease}
/* 渐显的同时粒子从低速加速到最快速度 */
@keyframes dsh2d-particles-in{
  0%{opacity:0;--dsh2d-speed:.15}
  100%{opacity:1;--dsh2d-speed:1}
}
.dsh2d-particles .dsh2d-p{
  position:absolute;border-radius:50%;will-change:transform,opacity;
  animation-name:dsh2d-particle;
  animation-timing-function:linear;
  animation-delay:var(--delay,0s);
  animation-iteration-count:infinite;
  animation-duration:calc(var(--dur,4s)/var(--dsh2d-speed,1));
}
@keyframes dsh2d-particle{
  0%{transform:translate3d(0,0,0);opacity:0}
  12%{opacity:var(--po,.3)}
  88%{opacity:var(--po,.3)}
  100%{transform:translate3d(var(--dx,0),var(--dy,-36px),0);opacity:0}
}
@media (prefers-reduced-motion:reduce){
  .dsh2d-max-halo{animation:none}
  .dsh2d-particles{display:none}
}
.dsh2d-error{position:relative;z-index:1;margin-top:6px;font-size:11px;color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh2d-note{position:relative;z-index:1;margin-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8a8a);text-align:center}
`

    if (typeof document !== 'undefined' && !document.querySelector('style[data-dsh2d]')) {
      const style = document.createElement('style')
      style.dataset.dsh2d = '1'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /* ---------------- 主组件 ---------------- */
    function GridSelector(props) {
      const { sessionId, locked } = props
      const ctx = props.__ctx

      const [open, setOpen] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [preview, setPreview] = React.useState(null) // {row,col} 拖动/键盘预览
      const [dragPoint, setDragPoint] = React.useState(null) // {x,y} 拖拽时滑点的连续坐标
      const [dragging, setDragging] = React.useState(false)
      const [hover, setHover] = React.useState(false)
      const [particleState, setParticleState] = React.useState('off') // off | in | out（粒子渐显/渐隐）
      const [pos, setPos] = React.useState(null)

      const anchorRef = React.useRef(null)
      const popRef = React.useRef(null)
      const padRef = React.useRef(null)

      const projection = useModelSelection(ctx, sessionId)
      const catalog = useModelCatalog(ctx)
      const rows = React.useMemo(() => {
        const list = flattenModels(catalog)
        const scored = list.map((e, i) => ({
          e, i,
          s: strengthOf(e),
          n: (e.model && e.model.reasoning && Array.isArray(e.model.reasoning.efforts) ? e.model.reasoning.efforts.length : 0),
        }))
        scored.sort((a, b) => b.s - a.s || b.n - a.n || a.i - b.i)
        return scored.map((x) => x.e)
      }, [catalog])

      // 左栏宽度按最长模型名自适应（模型名完整显示，不截断）
      const nameWidth = (s) => {
        let w = 0
        for (const ch of String(s)) w += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 12 : 6.6
        return w
      }
      const maxNameW = rows.reduce((m, e) => Math.max(m, nameWidth(e.model.name || e.model.id)), 0)
      const labelW = Math.min(300, Math.max(LABEL_W, Math.ceil(maxNameW) + 26))
      const cxOf = (col) => labelW + (col + 0.5) * CELL_W

      // 列 = 全部模型档位的并集，按强度升序排
      const cols = React.useMemo(() => {
        const seen = new Map()
        for (const e of rows) {
          for (const f of effectiveEfforts(e.model)) {
            const k = lower(f.id)
            if (!seen.has(k)) seen.set(k, f)
          }
        }
        const list = Array.from(seen.values())
        list.sort((a, b) => rankOf(a.id) - rankOf(b.id) || (a.id < b.id ? -1 : 1))
        return list
      }, [rows])

      const fallback = catalog && catalog.default ? catalog.default : null
      const current = (projection && (projection.next || projection.lastUsed)) || fallback
      const entry = findEntry(rows, current)

      const effs = entry ? effectiveEfforts(entry.model) : []
      const activeEffortId =
        (current && current.reasoningEffort) ||
        (entry && entry.model.reasoning && entry.model.reasoning.defaultEffort) ||
        (effs[0] && effs[0].id)
      const colIndexOf = (effortId) => cols.findIndex((c) => lower(c.id) === lower(effortId))
      const curRow = entry ? rows.indexOf(entry) : -1
      const curCol = entry ? colIndexOf(activeEffortId) : -1

      const validCell = (r, c) => {
        if (r < 0 || r >= rows.length || c < 0 || c >= cols.length) return false
        const model = rows[r].model
        return effectiveEfforts(model).some((e) => lower(e.id) === lower(cols[c].id))
      }

      const cellFromPoint = (clientX, clientY) => {
        const el = padRef.current
        if (!el) return null
        const rect = el.getBoundingClientRect()
        const px = clientX - rect.left
        const py = clientY - rect.top
        let best = null
        let bestD = Infinity
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < cols.length; c++) {
            if (!validCell(r, c)) continue
            const dx = px - cxOf(c)
            const dy = py - cyOf(r)
            const d = dx * dx + dy * dy
            if (d < bestD) { bestD = d; best = { row: r, col: c } }
          }
        }
        return best
      }

      const subagentLocked =
        ctx && ctx.sessions && typeof ctx.sessions.subagentAddress === 'function'
          ? ctx.sessions.subagentAddress(sessionId) !== undefined
          : false
      const disabled = !!locked || !!subagentLocked

      /* ---------- 写入 ---------- */
      const commit = React.useCallback(
        async (cell) => {
          if (!cell || disabled || busy) return
          const e = rows[cell.row]
          const effortId = cols[cell.col] && cols[cell.col].id
          if (!e || !e.model) return
          const next = { provider: e.provider, model: e.model.id }
          if (effortId !== undefined && effortId !== DEFAULT_EFFORT_ID) next.reasoningEffort = effortId
          // 与当前相同则不重复提交，也不关闭面板
          if (
            current &&
            current.provider === next.provider &&
            current.model === next.model &&
            ((next.reasoningEffort === undefined && !current.reasoningEffort) ||
              next.reasoningEffort === current.reasoningEffort)
          ) {
            setPreview(null)
            return
          }
          setBusy(true)
          setError('')
          try {
            const result = await ctx.remote.session.selectModel(Object.assign({ sessionId }, next))
            if (!result || !result.ok) {
              const code = result && result.error ? result.error.code : ''
              const message = result && result.error ? result.error.message : '模型选择失败'
              const friendly =
                code === 'session/writer-held'
                  ? '会话被其他 DSH 进程占用，请退出后重试。'
                  : /owned by subagent routing|subagent routing/i.test(message)
                    ? '当前会话由子代理路由接管，不能修改模型或思考强度。'
                    : message
              setError(friendly)
              setPreview(null)
            }
            // 成功：面板保持打开，滑点停在已确认的点上；投影更新后由 effect 清理 preview
          } catch (cause) {
            setError(String((cause && cause.message) || cause))
            setPreview(null)
          } finally {
            setBusy(false)
          }
        },
        [ctx, sessionId, disabled, busy, rows, cols, current],
      )

      /* ---------- 定位卡片 ---------- */
      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const anchor = anchorRef.current
          const pop = popRef.current
          if (!anchor || !pop) return
          const r = anchor.getBoundingClientRect()
          const pw = pop.offsetWidth
          const ph = pop.offsetHeight
          const vw = window.innerWidth
          const vh = window.innerHeight
          let left = Math.round(r.left)
          if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8)
          let top = Math.round(r.bottom + 8)
          if (top + ph > vh - 8) top = Math.max(8, r.top - ph - 8)
          setPos({ left, top })
        }
        place()
        const onChange = (event) => {
          const t = event && event.target
          if (t && t !== document && t !== window && popRef.current && popRef.current.contains(t)) return
          place()
        }
        window.addEventListener('resize', onChange)
        window.addEventListener('scroll', onChange, true)
        return () => {
          window.removeEventListener('resize', onChange)
          window.removeEventListener('scroll', onChange, true)
        }
      }, [open, rows.length, cols.length])

      /* ---------- 关闭行为 ---------- */
      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const hit = (node) => {
            if (!node) return false
            if (typeof node.contains === 'function' && event.target && node.contains(event.target)) return true
            if (typeof node.getBoundingClientRect !== 'function') return false
            const rect = node.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0 &&
              event.clientX >= rect.left && event.clientX <= rect.right &&
              event.clientY >= rect.top && event.clientY <= rect.bottom
          }
          if (hit(popRef.current) || hit(anchorRef.current)) return
          setOpen(false)
          setPreview(null)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') { setOpen(false); setPreview(null) }
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      /* ---------- 拖拽 ---------- */
      const pointFromClient = (clientX, clientY) => {
        const el = padRef.current
        if (!el) return null
        const rect = el.getBoundingClientRect()
        const x = Math.max(labelW, Math.min(rect.width - 2, clientX - rect.left))
        const y = Math.max(LABEL_H, Math.min(rect.height - 2, clientY - rect.top))
        return { x, y }
      }
      const startDrag = (event) => {
        if (disabled || busy) return
        event.preventDefault()
        let currentCell = cellFromPoint(event.clientX, event.clientY)
        const pt = pointFromClient(event.clientX, event.clientY)
        if (!currentCell || !pt) return
        setPreview(currentCell)
        setDragPoint(pt)
        setDragging(true)
        const move = (ev) => {
          const c = cellFromPoint(ev.clientX, ev.clientY)
          const p = pointFromClient(ev.clientX, ev.clientY)
          if (c) { currentCell = c; setPreview(c) }
          if (p) setDragPoint(p)
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          setDragging(false)
          setDragPoint(null)
          commit(currentCell) // 保留 preview，投影更新后再清理；面板不关闭
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }

      /* ---------- 键盘 ---------- */
      const stepCell = (start, dr, dc) => {
        const base = start || (curRow >= 0 && curCol >= 0 ? { row: curRow, col: curCol } : { row: 0, col: 0 })
        let r = base.row
        let c = base.col
        for (let i = 0; i < Math.max(rows.length, cols.length) + 1; i++) {
          r += dr
          c += dc
          if (r < 0 || r >= rows.length || c < 0 || c >= cols.length) return base
          if (validCell(r, c)) return { row: r, col: c }
        }
        return base
      }
      const onPadKeyDown = (event) => {
        if (!open) return
        const map = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        }
        const dir = map[event.key]
        if (dir) {
          event.preventDefault()
          const next = stepCell(preview, dir[1], dir[0])
          setPreview(next)
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          commit(preview)
        }
      }

      const rowCount = rows.length
      const colCount = cols.length
      const gridW = colCount * CELL_W
      const gridH = rowCount * CELL_H
      const svgW = labelW + gridW
      const svgH = LABEL_H + gridH

      // 当前显示点：拖动预览 > 键盘预览 > 真实投影
      const firstValidCol = (r) => {
        for (let c = 0; c < cols.length; c++) if (validCell(r, c)) return c
        return -1
      }
      const resolvedCurCol = curCol >= 0 ? curCol : (curRow >= 0 ? firstValidCol(curRow) : -1)
      const showCell = preview || (curRow >= 0 && resolvedCurCol >= 0 ? { row: curRow, col: resolvedCurCol } : null)
      const showX = showCell ? cxOf(showCell.col) : 0
      const showY = showCell ? cyOf(showCell.row) : 0
      // 拖拽中滑点跟随指针连续移动；否则吸附到已确认/当前交叉点
      const puckX = dragging && dragPoint ? dragPoint.x : showX
      const puckY = dragging && dragPoint ? dragPoint.y : showY

      // 投影跟上后清理 preview，让滑点落到「真实当前」交叉点
      React.useEffect(() => {
        if (preview && !dragging && curRow >= 0 && resolvedCurCol >= 0 &&
          preview.row === curRow && preview.col === resolvedCurCol) {
          setPreview(null)
        }
      }, [preview, dragging, curRow, resolvedCurCol])

      // 最右列视为 MAX 档（最高档特殊视觉）
      const isMaxCol = (c) => colCount > 1 && c === colCount - 1
      const showIsMax = !!(showCell && isMaxCol(showCell.col))
      // 已提交的当前选择是否在 max 档（触发按钮用）
      const currentIsMax = curRow >= 0 && resolvedCurCol >= 0 && isMaxCol(resolvedCurCol)

      // 粒子层：选中 max 渐显，离开 max 渐隐后再卸载
      React.useEffect(() => {
        if (showIsMax) { setParticleState('in'); return undefined }
        setParticleState((prev) => (prev === 'off' ? 'off' : 'out'))
        const timer = setTimeout(() => setParticleState('off'), 420)
        return () => clearTimeout(timer)
      }, [showIsMax])
      // 指针是否落在滑点附近（用于 hover 状态）
      const nearPuck = (clientX, clientY) => {
        const el = padRef.current
        if (!el) return false
        const rect = el.getBoundingClientRect()
        const dx = (clientX - rect.left) - puckX
        const dy = (clientY - rect.top) - puckY
        return dx * dx + dy * dy <= (PUCK_R + 9) * (PUCK_R + 9)
      }

      // 触发按钮文案
      const modelLabel = entry ? (entry.model.name || entry.model.id) : (current ? current.model : '选择模型')
      const effortLabel = effs.length ? tierLabel(effs[Math.max(0, effs.findIndex((e) => lower(e.id) === lower(activeEffortId)))]).short : ''

      const buildSvgChildren = () => {
        const children = []
        const gridLine = 'rgba(77,107,254,0.16)'
        const dotIdle = 'rgba(77,107,254,0.42)'
        const maxCol = colCount > 1 ? colCount - 1 : -1

        // 渐变 defs（max 档专用）
        children.push(
          h('defs', { key: 'defs' },
            h('linearGradient', { id: MAX_GRAD_ID, x1: '0', y1: '0', x2: '1', y2: '1' },
              h('stop', { offset: '0%', stopColor: DS_BLUE }),
              h('stop', { offset: '100%', stopColor: DS_VIOLET }),
            ),
          ),
        )
        // 细网格线（列 / 行中心）
        for (let c = 0; c < colCount; c++) {
          children.push(h('line', {
            key: 'vl' + c, x1: cxOf(c), y1: LABEL_H, x2: cxOf(c), y2: LABEL_H + gridH,
            stroke: gridLine, strokeWidth: 1, opacity: 0.6,
          }))
        }
        for (let r = 0; r < rowCount; r++) {
          children.push(h('line', {
            key: 'hl' + r, x1: labelW, y1: cyOf(r), x2: labelW + gridW, y2: cyOf(r),
            stroke: gridLine, strokeWidth: 1, opacity: 0.6,
          }))
        }
        // 列标题（适配器原生英文名；max 档用渐变）
        for (let c = 0; c < colCount; c++) {
          const label = tierLabel(cols[c]).short
          const isMax = c === maxCol
          children.push(
            h('text', {
              key: 'ch' + c, x: cxOf(c), y: 18, textAnchor: 'middle',
              fontSize: 11, fontWeight: isMax ? 700 : 600,
              fill: isMax ? 'url(#' + MAX_GRAD_ID + ')' : 'var(--dsw-alias-label-secondary,#8a8a8a)',
            }, label),
          )
        }
        // 行标题（模型名，左对齐；强的模型已排在上面）
        for (let r = 0; r < rowCount; r++) {
          const name = rows[r].model.name || rows[r].model.id
          children.push(
            h('text', {
              key: 'rh' + r, x: 12, y: cyOf(r) + 4, textAnchor: 'start',
              fontSize: 12, fill: 'var(--dsw-alias-label-primary,#161616)',
            }, name),
          )
        }
        // 有效交叉点圆点
        for (let r = 0; r < rowCount; r++) {
          for (let c = 0; c < colCount; c++) {
            if (!validCell(r, c)) continue
            const isHighlight = showCell && r === showCell.row && c === showCell.col
            const isMax = c === maxCol
            const cx = cxOf(c)
            const cy = cyOf(r)
            // 强化版只作用于「滑点所在的 max 圆点」：更大 + 双层脉冲光环
            if (isHighlight && isMax) {
              children.push(
                h('circle', { key: 'mh0-' + r + '-' + c, className: 'dsh2d-max-halo', cx, cy, r: 9, opacity: 0, fill: 'none', stroke: DS_VIOLET, strokeWidth: 2 }),
                h('circle', { key: 'mh1-' + r + '-' + c, className: 'dsh2d-max-halo dsh2d-delay', cx, cy, r: 9, opacity: 0, fill: 'none', stroke: DS_VIOLET, strokeWidth: 2 }),
              )
            }
            const fill = isHighlight ? (isMax ? DS_VIOLET : DS_BLUE) : (isMax ? DS_VIOLET : dotIdle)
            const radius = isHighlight ? (isMax ? 5.5 : 4.5) : 3.5
            children.push(
              h('circle', {
                key: 'd' + r + '-' + c, cx, cy, r: radius,
                fill, opacity: isHighlight ? 1 : (isMax ? 0.9 : 0.55),
              }),
            )
          }
        }
        // 拖拽中在最近有效交叉点画「将吸附到这里」的虚线环
        if (dragging && preview) {
          children.push(
            h('circle', {
              key: 'preview-ring', cx: cxOf(preview.col), cy: cyOf(preview.row), r: PUCK_R + 4,
              fill: 'none', stroke: DS_BLUE, strokeWidth: 1.5, strokeDasharray: '3 3', opacity: 0.85,
              style: { pointerEvents: 'none' },
            }),
          )
        }
        // 滑点（拖拽中跟手；hover / 抓取时有微小缩放；max 档渐变 + 光晕）
        if (showCell) {
          const isMax = showIsMax
          const scale = dragging ? 0.94 : hover ? 1.08 : 1
          const glowR = isMax ? PUCK_R + 10 : PUCK_R + 7
          const glowOp = dragging ? 0.3 : hover ? 0.24 : (isMax ? 0.22 : 0.16)
          const fill = isMax ? 'url(#' + MAX_GRAD_ID + ')' : (dragging ? DS_BLUE_DEEP : DS_BLUE)
          const ringW = dragging ? 2.5 : 2
          children.push(
            h(
              'g',
              {
                key: 'puck',
                transform: 'translate(' + puckX + ',' + puckY + ') scale(' + scale + ')',
                className: 'dsh2d-puck' + (dragging ? ' dsh2d-dragging' : ''),
                style: { pointerEvents: 'none' },
              },
              h('circle', { key: 'glow', className: 'dsh2d-glow', cx: 0, cy: 0, r: glowR, fill: isMax ? DS_VIOLET : DS_BLUE, opacity: glowOp }),
              h('circle', { key: 'body', cx: 0, cy: 0, r: PUCK_R, fill }),
              h('circle', { key: 'ring', cx: 0, cy: 0, r: PUCK_R, fill: 'none', stroke: 'var(--dsw-alias-bg-overlay,#ffffff)', strokeWidth: ringW }),
              h('circle', { key: 'core', cx: 0, cy: 0, r: 3, fill: '#ffffff' }),
            ),
          )
        }
        return children
      }

      const trigger = h(
        'button',
        {
          ref: anchorRef,
          className: 'dsh2d-trigger' + (currentIsMax ? ' dsh2d-max' : ''),
          type: 'button',
          disabled: disabled,
          onClick: () => { if (!disabled) { setOpen((o) => !o); setPreview(null); setError('') } },
          'aria-label': '选择模型与推理强度',
          'aria-expanded': open,
        },
        h('span', { className: 'dsh2d-model' }, modelLabel),
        effortLabel ? h('span', { className: 'dsh2d-effort' }, '· ' + effortLabel) : null,
        h(
          'svg',
          { className: 'dsh2d-chevron', width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': true },
          h('path', { d: 'M4 6l4 4 4-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        ),
      )

      let pop = null
      if (open) {
        const note =
          !sessionId
            ? '没有会话，无法切换模型'
            : subagentLocked
              ? '当前会话由子代理路由接管，不能修改模型或思考强度。'
              : rowCount === 0
                ? '没有可用模型'
                : ''
        const svg = h(
          'svg',
          {
            ref: padRef,
            className: 'dsh2d-pad' + (dragging ? ' dsh2d-grabbing' : hover ? ' dsh2d-hovering' : ''),
            width: svgW,
            height: svgH,
            viewBox: '0 0 ' + svgW + ' ' + svgH,
            tabIndex: 0,
            role: 'group',
            'aria-label': '二维模型选择器',
            onPointerDown: startDrag,
            onPointerMove: (e) => { if (!dragging) setHover(nearPuck(e.clientX, e.clientY)) },
            onPointerLeave: () => { if (!dragging) setHover(false) },
            onKeyDown: onPadKeyDown,
          },
          buildSvgChildren(),
        )
        const makeParticles = () => {
          const parts = []
          const COLS = 6
          const ROWS = 6
          const N = COLS * ROWS // 36 颗，均匀网格分布
          for (let i = 0; i < N; i++) {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const size = 2 + ((i * 7) % 3)
            parts.push(h('span', {
              key: 'p' + i,
              className: 'dsh2d-p',
              style: {
                left: (6 + col * 17.6) + '%',
                top: (10 + row * 15.6) + '%',
                width: size + 'px',
                height: size + 'px',
                background: i % 3 === 0 ? DS_BLUE : DS_VIOLET,
                '--dx': (70 + (i % 5) * 16) + 'px',
                '--dy': (((i % 3) - 1) * 4) + 'px',
                '--dur': (1.8 + (i % 5) * 0.35) + 's',
                '--delay': (-((i * 3) % 8)) + 's',
                '--po': 0.22 + ((i * 11) % 18) / 100,
              },
            }))
          }
          return parts
        }
        pop = ReactDOM.createPortal(
          h(
            'div',
            {
              ref: popRef,
              className: 'dsh2d-pop',
              style: pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 },
              role: 'dialog',
              'aria-label': '模型 × 推理强度选择器',
            },
            particleState !== 'off'
              ? h('div', { className: 'dsh2d-particles' + (particleState === 'out' ? ' dsh2d-fading' : ''), 'aria-hidden': true }, makeParticles())
              : null,
            note
              ? h('div', { className: 'dsh2d-note' }, note)
              : h('div', { className: 'dsh2d-scroll' }, svg),
            error ? h('div', { className: 'dsh2d-error' }, error) : null,
          ),
          document.body,
        )
      }

      return h('span', { className: 'dsh2d-root' }, trigger, pop)
    }

    /* ---------------- 挂载 ---------------- */
    function apply(ctx) {
      const Bound = (props) => h(GridSelector, Object.assign({}, props, { __ctx: ctx }))
      Bound.displayName = 'ModelPicker2D'
      try {
        ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, priority: SLOT_PRIORITY }, Bound))
      } catch (cause) {
        if (typeof console !== 'undefined') console.warn('[dsh-2d-model-picker] 挂载失败：', cause)
      }
    }

    return { name: PLUGIN_ID, inject: ['slots', 'sessions', 'remote', 'remote.session'], apply }
  },
})
