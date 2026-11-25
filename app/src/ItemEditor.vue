<script setup lang="ts">
import { moveEntry, removeEntry } from './listUtils'
import { newItem, type Item } from './model'

const items = defineModel<Item[]>('items', { required: true })

const props = withDefaults(defineProps<{
  label: string
  detailLabel: string
  maxItems?: number
}>(), {
  maxItems: 100,
})

function remove(index: number) {
  if (window.confirm(`Remove this ${props.label.toLowerCase()}?`)) {
    items.value = removeEntry(items.value, index)
  }
}

function move(index: number, offset: number) {
  items.value = moveEntry(items.value, index, offset)
}

function updateField(index: number, field: 'label' | 'detail', event: Event) {
  const value = (event.target as HTMLInputElement).value
  items.value = items.value.map((entry, currentIndex) =>
    currentIndex === index ? { ...entry, [field]: value } : entry,
  )
}

function add() {
  if (items.value.length >= props.maxItems) return
  items.value = [...items.value, newItem()]
}
</script>

<template>
  <div class="item-list">
    <div v-for="(entry, index) in items" :key="entry.id" class="item-card">
      <div class="item-controls">
        <strong>{{ label }} {{ index + 1 }}</strong>
        <button type="button" :disabled="index === 0" :aria-label="`Move ${label} ${index + 1} up`" @click="move(index, -1)">Up</button>
        <button type="button" :disabled="index === items.length - 1" :aria-label="`Move ${label} ${index + 1} down`" @click="move(index, 1)">Down</button>
        <button type="button" class="danger" :aria-label="`Remove ${label} ${index + 1}`" @click="remove(index)">Remove</button>
      </div>
      <label>{{ label }} <input :value="entry.label" maxlength="10000" :aria-label="`${label} ${index + 1}`" @input="updateField(index, 'label', $event)"></label>
      <label>{{ detailLabel }} <input :value="entry.detail" maxlength="10000" :aria-label="`${detailLabel} ${index + 1}`" @input="updateField(index, 'detail', $event)"></label>
    </div>
    <button type="button" :disabled="items.length >= maxItems" @click="add">+ Add {{ label.toLowerCase() }}</button>
  </div>
</template>
