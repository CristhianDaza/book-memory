import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarRating from './StarRating.vue'

describe('StarRating', () => {
  function mockStarRect(button: ReturnType<ReturnType<typeof mount<typeof StarRating>>['findAll']>[number]) {
    button.element.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 36,
      bottom: 36,
      width: 36,
      height: 36,
      toJSON: () => {},
    })
  }

  it('emits 0 when clicking the left half of the first star', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: null,
      },
    })

    const stars = wrapper.findAll('button')
    mockStarRect(stars[0]!)
    await stars[0]?.trigger('click', { clientX: 8 })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([0])
  })

  it('emits full value when clicking the right half of a star', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: null,
      },
    })

    const stars = wrapper.findAll('button')
    mockStarRect(stars[0]!)
    await stars[0]?.trigger('click', { clientX: 28 })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([1])
  })

  it('emits 0.5 when clicking the inner-left half of the first star', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: null,
      },
    })

    const stars = wrapper.findAll('button')
    mockStarRect(stars[0]!)
    await stars[0]?.trigger('click', { clientX: 12 })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([0.5])
  })

  it('emits half value when clicking the left half of later stars', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: null,
      },
    })

    const stars = wrapper.findAll('button')
    mockStarRect(stars[3]!)
    await stars[3]?.trigger('click', { clientX: 8 })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([3.5])
  })

  it('emits half value from touch pointer events on mobile', async () => {
    const wrapper = mount(StarRating, {
      props: {
        modelValue: null,
      },
    })

    const stars = wrapper.findAll('button')
    mockStarRect(stars[3]!)
    const PointerEventCtor = globalThis.PointerEvent ?? MouseEvent
    stars[3]?.element.dispatchEvent(
      new PointerEventCtor('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 8,
      }),
    )
    await wrapper.vm.$nextTick()
    await stars[3]?.trigger('click', { clientX: 28 })

    expect(wrapper.emitted('update:modelValue')).toEqual([[3.5]])
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
