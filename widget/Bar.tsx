import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { Accessor, createBinding, For } from "ags"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import Hyprland from "gi://AstalHyprland"
import PangoCairo from "gi://PangoCairo"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function formatDate() {
  const now = new Date()
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`
}

function formatTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

function RotatedLabel({
  class: className,
  label,
}: {
  class?: string
  label: string | Accessor<string>
}) {
  const getText = () => (typeof label === "string" ? label : label.get())

  return (
    <drawingarea
      class={className}
      hexpand={false}
      vexpand={false}
      $={(self) => {
        function sync() {
          const layout = self.create_pango_layout(getText())
          const [w, h] = layout.get_pixel_size()
          self.set_content_width(h)
          self.set_content_height(w)
          self.queue_draw()
        }

        sync()
        self.connect("realize", sync)

        if (typeof label !== "string") {
          const unsub = label.subscribe(sync)
          self.connect("unrealize", unsub)
        }

        self.set_draw_func((_area, cr, width) => {
          const layout = self.create_pango_layout(getText())
          const color = self.get_color()
          cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha)
          cr.translate(width, 0)
          cr.rotate(Math.PI / 2)
          PangoCairo.show_layout(cr, layout)
        })
      }}
    />
  )
}

function Workspaces() {
  const hypr = Hyprland.get_default()

  if (!hypr) {
    return <box class="Workspaces" orientation={Gtk.Orientation.VERTICAL} />
  }

  const workspaces = createBinding(hypr, "workspaces")((list) =>
    list.filter((ws) => ws.id > 0).sort((a, b) => a.id - b.id),
  )
  const focusedId = createBinding(hypr, "focusedWorkspace", "id")

  return (
    <box class="Workspaces" orientation={Gtk.Orientation.VERTICAL}>
      <For each={workspaces} id={(ws) => ws.id}>
        {(ws) => (
          <button
            class={focusedId((id) => (id === ws.id ? "current" : ""))}
            canFocus={false}
            focusOnClick={false}
            onClicked={() =>
              execAsync([
                "hyprctl",
                "dispatch",
                `hl.dsp.focus({ workspace = ${ws.id} })`,
              ]).catch(console.error)
            }
          >
            <label label={String(ws.id)} />
          </button>
        )}
      </For>
    </box>
  )
}

function Clock() {
  const date = createPoll(formatDate(), 1000, formatDate)
  const time = createPoll(formatTime(), 1000, formatTime)

  return (
    <box class="Clock" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <RotatedLabel class="Date" label={date} />
      <RotatedLabel class="Time" label={time} />
    </box>
  )
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      visible
      name="bar"
      class="Bar"
      namespace="bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | RIGHT | BOTTOM}
      application={app}
    >
      <centerbox
        class="Panel"
        orientation={Gtk.Orientation.VERTICAL}
        cssName="centerbox"
      >
        <box $type="start" class="Start">
          <Workspaces />
        </box>
        <box $type="center" vexpand />
        <box $type="end" class="End" orientation={Gtk.Orientation.VERTICAL}>
          <Clock />
        </box>
      </centerbox>
    </window>
  )
}
