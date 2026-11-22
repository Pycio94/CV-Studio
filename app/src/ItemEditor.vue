<script setup lang="ts">
import { newItem, type Item } from './model'

const props = defineProps<{
  items: Item[]
  label: string
  detailLabel: string
}>()

function remove(index: number) {
  if (window.confirm(`Remove this ${props.label.toLowerCase()}?`)) props.items.splice(index, 1)
}

function move(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= props.items.length) return
  const entry = props.items[index]
  if (!entry) return
  props.items.splice(index, 1)
  props.items.splice(target, 0, entry)
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
      <label>{{ label }} <input v-model="entry.label" :aria-label="`${label} ${index + 1}`"></label>
      <label>{{ detailLabel }} <input v-model="entry.detail" :aria-label="`${detailLabel} ${index + 1}`"></label>
    </div>
    <button type="button" @click="items.push(newItem())">+ Add {{ label.toLowerCase() }}</button>
  </div>
</template>
