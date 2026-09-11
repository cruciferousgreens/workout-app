
/* ===== module: custom-exercises.js ===== */
    /** Creates, edits, and deletes custom exercises (persisted to the library, synced across devices) with pill controls. */
    function customOptions() {
      return {
        muscles:[...new Set(exercises.flatMap(x => [...x.primary, ...x.secondary]))].filter(Boolean).sort(),
        equipment:[...new Set(exercises.map(x => x.equipment).filter(Boolean))].sort(),
        force:['push','pull','static'],
        mechanic:['compound','isolation'],
        tracking:['reps','time']
      };
    }

    function pillMarkup(values, selected) {
      return values.map(value => `<button class="form-pill" type="button" data-value="${escapeHtml(value)}" aria-pressed="${selected instanceof Set ? selected.has(value) : selected === value}">${escapeHtml(titleCase(value))}</button>`).join('');
    }

    function renderCustomPills() {
      const options = customOptions();
      $('#customPrimaryOptions').innerHTML = pillMarkup(options.muscles, customDraft.primary);
      $('#customSecondaryOptions').innerHTML = pillMarkup(options.muscles, customDraft.secondary);
      $('#customEquipmentOptions').innerHTML = pillMarkup(options.equipment, customDraft.equipment);
      $('#customForceOptions').innerHTML = pillMarkup(options.force, customDraft.force);
      $('#customMechanicOptions').innerHTML = pillMarkup(options.mechanic, customDraft.mechanic);
      $('#customTrackingOptions').innerHTML = pillMarkup(options.tracking, customDraft.tracking);

      $('#customPrimaryOptions').querySelectorAll('.form-pill').forEach(button => button.addEventListener('click', () => {
        const value = button.dataset.value;
        if (customDraft.primary.has(value)) customDraft.primary.delete(value);
        else { customDraft.primary.add(value); customDraft.secondary.delete(value); }
        renderCustomPills();
      }));
      $('#customSecondaryOptions').querySelectorAll('.form-pill').forEach(button => button.addEventListener('click', () => {
        const value = button.dataset.value;
        if (customDraft.secondary.has(value)) customDraft.secondary.delete(value);
        else { customDraft.secondary.add(value); customDraft.primary.delete(value); }
        renderCustomPills();
      }));
      [['#customEquipmentOptions','equipment'],['#customForceOptions','force'],['#customMechanicOptions','mechanic'],['#customTrackingOptions','tracking']].forEach(([selector,key]) => {
        $(selector).querySelectorAll('.form-pill').forEach(button => button.addEventListener('click', () => {
          customDraft[key] = customDraft[key] === button.dataset.value ? '' : button.dataset.value;
          renderCustomPills();
        }));
      });
    }

    function openCustomDialog(ex = null) {
      $('#customExerciseForm').reset();
      $('#customFormError').textContent = '';
      $('#customExerciseId').value = ex?.id || '';
      $('#customExerciseTitle').textContent = ex ? 'Edit custom exercise' : 'Custom exercise';
      $('#customExerciseForm .form-action.primary').textContent = ex ? 'Save changes' : 'Add exercise';
      customDraft.primary = new Set(ex?.primary || []);
      customDraft.secondary = new Set(ex?.secondary || []);
      customDraft.equipment = ex?.equipment || '';
      customDraft.force = ex?.force || '';
      customDraft.mechanic = ex?.mechanic || '';
      customDraft.tracking = ex?.tracking || 'reps';
      if (ex) {
        $('#customName').value = ex.name;
        $('#customInstructions').value = ex.instructions.join('\n');
      }
      renderCustomPills();
      $('#customExerciseDialog').showModal();
      requestAnimationFrame(() => $('#customName').focus());
    }

    function closeCustomDialog() {
      $('#customExerciseDialog').close();
    }

    function refreshFilters() {
      populateFilters();
      renderMuscleSelection();
      $('#equipmentFilter').value = state.equipment;
    }

    function deleteCustomExercise(id) {
      exercises = exercises.filter(ex => ex.id !== id);
      state.customExercises = state.customExercises.filter(ex => ex.id !== id);
      schedulePersist();
      refreshFilters();
      renderLibrary();
      showLibrary(false);
    }

    