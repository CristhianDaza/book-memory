import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarRating from './StarRating.vue'

describe('StarRating', () => {
  it('emits selected value on click', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: null,
      },
    })

    const stars = wrapper.findAll('button')
    await stars[3]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([4])
  })

  it('does not emit in readonly mode', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: 3,
        readonly: true,
      },
    })

    await wrapper.findAll('button')[4]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
